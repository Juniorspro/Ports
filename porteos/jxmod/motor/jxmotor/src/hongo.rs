//! El hongo de las nucleares con volumen (nuclear_vol.js de la web, el del tráiler): una marcha de rayos por un volumen cuya
//! forma cambia con el tiempo desde la detonación —la bola de fuego que sube, el toro que rueda con un domo encima, el tallo
//! que chupa del piso y la falda de polvo que corre por el suelo—, con el borde comido por ruido 3D (coliflor), la luz del
//! sol con sombra propia, la del cielo y del suelo, y el fuego de adentro que brilla y alumbra el humo. La forma en el
//! tiempo la arma el juego (jxjuego::nucleares::Explosion::nv_bloque) y llega en el cuadro como un bloque EF_HONGO.
//! Para OpenGL 3 y OpenGL 2 (los dos con glow): se dibuja en un búfer chico (un cuarto a la mitad del lado según la
//! calidad, más chico si el hongo llena la pantalla) sólo en el rectángulo donde cae, y se pega encima de la escena: en
//! OpenGL 3 con la profundidad del punto donde el rayo entra al humo (lo de adelante lo tapa); en OpenGL 2 —sin texturas
//! 3D, sin dos salidas ni gl_FragDepth— el ruido va en un mosaico 2D de 512 × 512 (las 64 capas) y el hongo se pega a la
//! profundidad de su frente (lo que está más cerca lo tapa). Vulkan sigue con los carteles.
use crate::escena::{Cuadro, EF_HONGO};
use crate::mat;
use glow::HasContext;
use std::collections::HashMap;
use std::sync::mpsc;

/// el lado del ruido (64³)
pub const N: usize = 64;

/// el ruido 3D (el mismo del tráiler: la misma semilla y el mismo orden): R bultos grandes, G medianos, B coliflor chica,
/// A jirones; RGBA8, 64³
pub fn ruido() -> Vec<u8> {
    let n = N; let n3 = n * n * n;
    let mut sem: f64 = 11.0;
    let mut rnd = move || { sem = (sem * 16807.0) % 2147483647.0; sem / 2147483647.0 };
    // (cada celular arma sus puntos y cada gradiente sus vectores al empezar, en este orden)
    let mut cs: Vec<(usize, Vec<f64>)> = vec![];
    for f in [4usize, 8, 16] { let p: Vec<f64> = (0..f * f * f * 3).map(|_| rnd()).collect(); cs.push((f, p)); }
    let mut gs: Vec<(usize, Vec<f64>)> = vec![];
    for f in [4usize, 8, 16, 32] {
        let mut g = vec![0.0; f * f * f * 3];
        for i in 0..f * f * f { let a = rnd() * 6.2832; let zz = rnd() * 2.0 - 1.0; let r = (1.0 - zz * zz).sqrt(); g[i * 3] = r * a.cos(); g[i * 3 + 1] = r * a.sin(); g[i * 3 + 2] = zz; }
        gs.push((f, g));
    }
    let w3 = |i: i64, f: usize| (((i % f as i64) + f as i64) % f as i64) as usize;
    let fd = |t: f64| t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
    let mut cel = vec![vec![0f64; n3]; 3]; let mut mn = [9f64; 3]; let mut mx = [-9f64; 3];
    for (k, (f, p)) in cs.iter().enumerate() {
        let kk = *f as f64 / n as f64;
        for z in 0..n { for y in 0..n { for x in 0..n {
            let (px, py, pz) = ((x as f64 + 0.5) * kk, (y as f64 + 0.5) * kk, (z as f64 + 0.5) * kk); let (cx, cy, cz) = (px.floor() as i64, py.floor() as i64, pz.floor() as i64);
            let mut m = 9.0f64;
            for dz in -1..=1 { for dy in -1..=1 { for dx in -1..=1 {
                let (ix, iy, iz) = (cx + dx, cy + dy, cz + dz); let j = ((w3(iz, *f) * f + w3(iy, *f)) * f + w3(ix, *f)) * 3;
                let (ex, ey, ez) = (ix as f64 + p[j] - px, iy as f64 + p[j + 1] - py, iz as f64 + p[j + 2] - pz); let d = ex * ex + ey * ey + ez * ez;
                if d < m { m = d; }
            } } }
            let v = 1.0 - m; cel[k][(z * n + y) * n + x] = v; if v < mn[k] { mn[k] = v; } if v > mx[k] { mx[k] = v; }
        } } }
    }
    let mut gr = vec![vec![0f64; n3]; 4];
    for (k, (f, g)) in gs.iter().enumerate() {
        let kk = *f as f64 / n as f64;
        let gg = |ix: i64, iy: i64, iz: i64, x: f64, y: f64, z: f64| { let j = ((w3(iz, *f) * f + w3(iy, *f)) * f + w3(ix, *f)) * 3; g[j] * x + g[j + 1] * y + g[j + 2] * z };
        for z in 0..n { for y in 0..n { for xx in 0..n {
            let (px, py, pz) = ((xx as f64 + 0.5) * kk, (y as f64 + 0.5) * kk, (z as f64 + 0.5) * kk); let (ix, iy, iz) = (px.floor() as i64, py.floor() as i64, pz.floor() as i64);
            let (fx, fy, fz) = (px - ix as f64, py - iy as f64, pz - iz as f64); let (u, v, w) = (fd(fx), fd(fy), fd(fz));
            let a = gg(ix, iy, iz, fx, fy, fz); let b = gg(ix + 1, iy, iz, fx - 1.0, fy, fz); let c = gg(ix, iy + 1, iz, fx, fy - 1.0, fz); let d = gg(ix + 1, iy + 1, iz, fx - 1.0, fy - 1.0, fz);
            let e = gg(ix, iy, iz + 1, fx, fy, fz - 1.0); let f2 = gg(ix + 1, iy, iz + 1, fx - 1.0, fy, fz - 1.0); let h = gg(ix, iy + 1, iz + 1, fx, fy - 1.0, fz - 1.0); let mm = gg(ix + 1, iy + 1, iz + 1, fx - 1.0, fy - 1.0, fz - 1.0);
            let (x1, x2, x3, x4) = (a + (b - a) * u, c + (d - c) * u, e + (f2 - e) * u, h + (mm - h) * u); let (y1, y2) = (x1 + (x2 - x1) * v, x3 + (x4 - x3) * v);
            gr[k][(z * n + y) * n + xx] = y1 + (y2 - y1) * w;
        } } }
    }
    for k in 0..3 { let r = mx[k] - mn[k]; for v in cel[k].iter_mut() { *v = (*v - mn[k]) / r; } }
    let cl = |x: f64| (x * 255.0).round().clamp(0.0, 255.0) as u8;
    let mut d = vec![0u8; n3 * 4];
    for i in 0..n3 {
        let pf = 0.5 + 0.9 * (0.5 * gr[0][i] + 0.25 * gr[1][i] + 0.125 * gr[2][i]);
        d[i * 4] = cl(0.62 * cel[0][i] + 0.38 * pf); d[i * 4 + 1] = cl(cel[1][i]); d[i * 4 + 2] = cl(cel[2][i]);
        d[i * 4 + 3] = cl(0.5 + 0.9 * (0.5 * gr[1][i] + 0.25 * gr[2][i] + 0.125 * gr[3][i]));
    }
    d
}
/// las 64 capas del ruido en un mosaico 2D de 8 × 8 (512 × 512): para OpenGL 2, que no tiene texturas 3D
pub fn mosaico(v: &[u8]) -> Vec<u8> {
    let mut o = vec![0u8; 512 * 512 * 4];
    for z in 0..N { let (tx, ty) = (z % 8, z / 8); for y in 0..N { let s = (z * N + y) * N * 4; let d = ((ty * N + y) * 512 + tx * N) * 4; o[d..d + N * 4].copy_from_slice(&v[s..s + N * 4]); } }
    o
}

/// lo de cada calidad (NV_CAL): la fracción del búfer, los pasos, las muestras de sombra, los bultos, el largo del paso, el
/// lado máximo del búfer y cuántas bombas a la vez van con volumen (las más cercanas)
#[derive(Clone, Copy, Debug)]
pub struct Cal { pub esc: f32, pub pasos: u32, pub som: u32, pub bul: u32, pub pk: f32, pub max: f32, pub n: usize }
/// la calidad del juego (0 Patata: sin volumen —los carteles—, 1 Bajo … 4 Ultra)
pub fn calidad(k: u8) -> Option<Cal> {
    Some(match k {
        0 => return None,
        1 => Cal { esc: 0.25, pasos: 18, som: 1, bul: 0, pk: 2.3, max: 360.0, n: 2 },
        2 => Cal { esc: 0.34, pasos: 32, som: 1, bul: 0, pk: 1.6, max: 520.0, n: 2 },
        3 => Cal { esc: 0.42, pasos: 48, som: 2, bul: 1, pk: 1.25, max: 680.0, n: 3 },
        _ => Cal { esc: 0.5, pasos: 64, som: 3, bul: 1, pk: 1.0, max: 820.0, n: 3 },
    })
}
fn defines(q: &Cal) -> String {
    let sk = 90.0 / [0.0, 10.0, 40.0, 90.0][q.som.min(3) as usize];
    format!("#define PASOS {}\n#define SOMBRA {}\n#define SOMBRAK {:.3}\n#define BULTOS {}\n#define PASOK {:.2}\n", q.pasos, q.som, sk, q.bul, q.pk)
}

/// el cuerpo del sombreador de la web (FS_NV), con las lecturas del ruido por TEX3 y la salida en 8 bits
const CUERPO: &str = r#"float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
float h12(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float sdHongo(vec3 p) {
  float rho = length(p.xz);
  float st = length(vec2(rho - uCap.y, p.y - uCap.x)) - uCap.z;
  float ax = uCap.y + 0.62 * uCap.z, ay = 1.0 * uCap.z;
  vec2 e = vec2(rho / ax, (p.y - uCap.x - 0.22 * uCap.z) / ay);
  float sd = max((length(e) - 1.0) * min(ax, ay), uCap.x - 0.15 * uCap.z - p.y);
  return smin(st, sd, 0.3 * uCap.z);
}
float sdTallo(vec3 p) {
  float top = uTallo.z, u = clamp(p.y / max(top, 1.0), 0.0, 1.0);
  float r = mix(uTallo.x, uTallo.y, u) + uTallo.x * 1.3 * exp(-p.y / 20.0);
  r *= 1.0 + 0.22 * sin(p.y * 0.034 - uTallo.w * 0.06) + 0.12 * sin(p.y * 0.083 + 1.7 - uTallo.w * 0.11);
  return max(length(p.xz) - r, p.y - top) + (1.0 - uDens.w) * 80.0;
}
float sdFalda(vec3 p) {
  float rho = length(p.xz), w = 0.5 * uFalda.z;
  vec2 d = vec2((rho - uFalda.x + w) / w, p.y / uFalda.y);
  float s1 = (length(d) - 1.0) * min(w, uFalda.y);
  float s2 = max(rho - uFalda.x + w, p.y - 0.45 * uFalda.y);
  return min(s1, s2) + (1.0 - uFalda.w) * 60.0;
}
vec3 qHongo(vec3 p) {
  float rho = length(p.xz); vec2 dir = rho > 0.01 ? p.xz / rho : vec2(1.0, 0.0);
  vec2 d = vec2(rho - uCap.y, p.y - uCap.x);
  float a = uCap.w * smoothstep(0.0, 0.8 * uCap.y + 1.0, rho), c = cos(a), s = sin(a);
  vec2 r = vec2(c * d.x - s * d.y, s * d.x + c * d.y);
  float rr = uCap.y + r.x;
  return vec3(dir.x * rr, uCap.x + r.y, dir.y * rr);
}
float ruido(vec3 q, float L) {
  vec4 a = TEX3(q / L), b = TEX3(q / (L * 0.29));
  return (a.r - 0.5) * 0.56 + (a.g - 0.5) * 0.24 + (b.b - 0.5) * 0.13 + (b.a - 0.5) * 0.07;
}
float ruidoG(vec3 q, float L) { vec4 a = TEX3(q / L); return (a.r - 0.5) * 0.56 + (a.g - 0.5) * 0.24; }
vec3 cuerpoNegro(float T) {
  vec3 c = vec3(1.0, 0.18, 0.02);
  c = mix(c, vec3(1.0, 0.42, 0.08), smoothstep(0.25, 0.5, T));
  c = mix(c, vec3(1.0, 0.72, 0.36), smoothstep(0.5, 0.78, T));
  c = mix(c, vec3(1.0, 0.95, 0.86), smoothstep(0.78, 1.05, T));
  return c * (0.2 + 0.8 * smoothstep(0.1, 0.55, T));
}
float hg(float c, float g) { float g2 = g * g; return (1.0 - g2) / pow(max(1.0 + g2 - 2.0 * g * c, 1e-4), 1.5); }
float medio(vec3 p, out vec3 cual, out float cal, out float sBase, out float dSup) {
  float sh = sdHongo(p), stl = sdTallo(p), sf = sdFalda(p);
  sBase = min(sh, min(stl, sf));
  float Rn = uCap.z, Ah = 0.62 * Rn, At = 1.0 * uTallo.x + 8.0, Af = 1.0 * uFalda.y + 6.0;
  float m = sBase;
  float nh = 0.0, nt = 0.0, nf = 0.0;
  if (sh < m + Ah * 0.6 && sh < Ah * 0.6) nh = ruido(qHongo(p), 2.3 * Rn);
  if (stl < m + At * 0.6 && stl < At * 0.6) { float g = 0.004 * p.y + 0.12 * uTallo.w / 32.0, cg = cos(g), sg = sin(g); nt = ruido(vec3(cg * p.x - sg * p.z, p.y - uTallo.w, sg * p.x + cg * p.z), 1.3 * uTallo.x + 18.0); }
  if (sf < m + Af * 0.6 && sf < Af * 0.6) { float k = 120.0 / max(uFalda.x, 60.0); nf = ruido(vec3(p.x * k, p.y * 1.6, p.z * k) + vec3(17.0, 0.0, 31.0), 75.0); }
  float blando = 3.0 + 0.02 * Rn;
  float dh = clamp(-(sh - Ah * 2.0 * nh) / blando, 0.0, 1.0) * uDens.x;
  float dt = clamp(-(stl - At * 2.0 * nt) / (blando * 1.6), 0.0, 1.0) * uDens.y;
  float df = clamp(-(sf - Af * 2.0 * nf) / (blando * 2.0), 0.0, 1.0) * uDens.z * (1.0 - smoothstep(0.0, uFalda.y * 1.4, p.y) * 0.6) * mix(0.35, 1.0, smoothstep(uFalda.x - 1.2 * uFalda.z, uFalda.x - 0.5 * uFalda.z, length(p.xz)));
  // (la distancia a la superficie ya deformada por el ruido: afuera, cuánto se puede saltar sin pisar humo)
  dSup = min(sh - Ah * 2.0 * nh, min(stl - At * 2.0 * nt, sf - Af * 2.0 * nf));
  float tot = max(dh, max(dt, df));
  cual = vec3(dh, dt, df) / max(dh + dt + df, 1e-6);
  float prof = -(sh - Ah * 2.0 * nh);
  float bajo = 1.0 - smoothstep(-0.6 * Rn, 0.7 * Rn, p.y - uCap.x);
  float piel = mix(3.0, 0.4 * Rn, uFuego.z) * mix(1.0, 0.45, bajo);   // (más fina que en el tráiler: el fuego de adentro se ve más tiempo)
  cal = smoothstep(piel * 0.6, piel * 1.6 + 6.0, prof) * mix(1.0, 0.35 + 0.65 * bajo, uFuego.z) * cual.x;
  cal += smoothstep(0.55, 1.0, p.y / max(uTallo.z, 1.0)) * (1.0 - uFuego.z * 0.85) * 0.7 * cual.y * smoothstep(2.0, 12.0, -(stl - At * 2.0 * nt));
  return tot;
}
float base(vec3 p) { return min(sdHongo(p), min(sdTallo(p), sdFalda(p))); }
float medioG(vec3 p) {
  float sh = sdHongo(p), stl = sdTallo(p), sf = sdFalda(p), Rn = uCap.z, Ah = 0.62 * Rn, At = 1.0 * uTallo.x + 8.0, Af = 1.0 * uFalda.y + 6.0, blando = 3.0 + 0.02 * Rn;
  float dh = 0.0, dt = 0.0, df = 0.0;
  if (sh < Ah * 0.6) dh = clamp(-(sh - Ah * 2.0 * ruidoG(qHongo(p), 2.3 * Rn)) / blando, 0.0, 1.0) * uDens.x;
  if (stl < At * 0.6) dt = clamp(-(stl - At * 2.0 * ruidoG(vec3(p.x, p.y - uTallo.w, p.z), 1.3 * uTallo.x + 18.0)) / (blando * 1.6), 0.0, 1.0) * uDens.y;
  if (sf < Af * 0.6) df = clamp(-sf / (blando * 2.0), 0.0, 1.0) * uDens.z;
  return max(dh, max(dt, df));
}
void main() {
  vec3 rd = normalize(vD - uCam), ro = (uCam - uO) / uEsc;
  float a = dot(rd.xz, rd.xz), b = dot(ro.xz, rd.xz), c = dot(ro.xz, ro.xz) - uCaja.x * uCaja.x, disc = b * b - a * c;
  if (disc <= 0.0 || a < 1e-9) discard;
  float sq = sqrt(disc), t0 = (-b - sq) / a, t1 = (-b + sq) / a;
  float ty0 = (0.0 - ro.y) / rd.y, ty1 = (uCaja.y - ro.y) / rd.y;
  float tA = max(max(t0, min(ty0, ty1)), 0.0), tB = min(t1, max(ty0, ty1));
  if (tA >= tB) discard;
  float Rn = uCap.z, paso = max(2.2, 0.045 * Rn) * PASOK;
  float t = tA + h12(gl_FragCoord.xy + uSem) * paso, Tr = 1.0, tHit = -1.0;
  vec3 col = vec3(0.0);
  float cosT = dot(rd, uSol), fase = mix(hg(cosT, 0.3), hg(cosT, -0.1), 0.45) * 0.8 + 0.2;
  float margen = 0.62 * Rn + 8.0;
  for (int i = 0; i < PASOS; i++) {
    if (t > tB || Tr < 0.02) break;
    vec3 p = ro + rd * t;
    float sb = base(p);
    if (sb > margen) { t += max(sb - margen * 0.9, paso); continue; }
    vec3 cual; float cal, sBase, dSup;
    float sig = medio(p, cual, cal, sBase, dSup);
    // (afuera del humo, aunque cerca: se salta lo que asegura la superficie con ruido; con pocos pasos, si se fuera de a uno
    // por la franja que rodea al hongo, el rayo se terminaba antes de cruzarlo y el sombrero quedaba transparente)
    if (sig <= 0.0005) { t += max(paso, dSup * 0.6); continue; }
    {
      if (tHit < 0.0) tHit = t;
      float sl = 0.0;
      for (int j = 1; j <= SOMBRA; j++) { float d = float(j * j) * 10.0 + 4.0; sl += clamp(-base(p + uSol * d) / (0.3 * Rn), 0.0, 1.0) * float(2 * j - 1) * 10.0; }
      sl *= SOMBRAK;
      float sigK = dot(cual, uDens.xyz);
#if BULTOS
      float sig2 = medioG(p + uSol * (0.09 * Rn + 2.0));
      float bul = clamp(1.0 - (sig2 - sig) / max(sigK, 1e-4) * 0.9, 0.12, 1.0);
#else
      float bul = 1.0;
#endif
      float Ts = max(exp(-sl * sigK * 0.9), 0.3 * exp(-sl * sigK * 0.15)) * bul;
      vec3 alb = uAlbH * cual.x + uAlbT * cual.y + uAlbF * cual.z;
      alb *= mix(1.0, 0.55, uFuego.z * cual.x * (1.0 - smoothstep(-0.3 * Rn, 0.9 * Rn, p.y - uCap.x)));
      float arriba = clamp((p.y - uCap.x) / (1.2 * Rn) * 0.5 + 0.5, 0.0, 1.0);
      float occ = exp(-max(0.0, -sBase) / (0.55 * Rn));
      vec3 amb = (uAmbS * (0.45 + 0.55 * arriba) + uAmbG * (0.55 - 0.4 * arriba)) * occ;
      float dt2 = length(vec2(length(p.xz) - uCap.y, p.y - uCap.x));
      vec3 fuegoL = cuerpoNegro(uFuego.y * 0.85) * uFuego.w * (Rn * Rn) / (Rn * Rn + dt2 * dt2 * 1.6) * (cual.y + cual.z + cual.x * 0.5 * (1.0 - smoothstep(-0.5 * Rn, 0.2 * Rn, p.y - uCap.x)));
      float Rext = uCap.y + uCap.z, cov = (1.0 - smoothstep(0.8 * Rext, 1.15 * Rext, length(p.xz))) * (1.0 - smoothstep(uCap.x - 0.9 * Rn, uCap.x - 0.3 * Rn, p.y)) * (1.0 - cual.x);
      amb *= mix(1.0, 0.38, cov); Ts *= mix(1.0, 0.3, cov);
      vec3 S = alb * (uSolC * fase * Ts + amb + fuegoL);
      S += cuerpoNegro(uFuego.y + 0.25 * cal) * uFuego.x * cal;
      float fN = clamp((t * uEsc - uNieA) / max(1.0, uNieB - uNieA), 0.0, 1.0);
      S = mix(S, uNieC, fN * fN * uNieK);
      float Tp = exp(-sig * paso);
      col += Tr * (1.0 - Tp) * S; Tr *= Tp;
    }
    t += paso;
  }
  if (Tr < 0.03) { col /= (1.0 - Tr); Tr = 0.0; }
  if (tHit < 0.0 || Tr > 0.998) discard;
  // (en 8 bits: el color ya en la pantalla —la misma curva que el pegado— y la distancia en 2 canales: hasta 16 km, de a 25 cm)
  vec3 u = col / max(1.0 - Tr, 1e-4);
  SALIDA_COLOR(vec4(pow(1.0 - exp(-u * uExpo), vec3(0.4545)) * (1.0 - Tr), 1.0 - Tr));
  float dn = clamp(tHit * uEsc / 16384.0, 0.0, 1.0) * 255.0;
  SALIDA_DIST(vec4(floor(dn) / 255.0, fract(dn), 0.0, 1.0));
}"#;
const UNIFORMES: &str = "uniform vec3 uCam, uO, uSol, uSolC, uAmbS, uAmbG, uNieC, uAlbH, uAlbT, uAlbF;\nuniform float uNieA, uNieB, uNieK, uSem, uEsc, uExpo;\nuniform vec4 uCap, uTallo, uFalda, uFuego, uDens;\nuniform vec2 uCaja;\n";
const VS3: &str = "#version 300 es\nuniform mat4 uIVP; out vec3 vD;\nvoid main(){ vec2 aP = vec2(float((gl_VertexID & 1) << 2) - 1.0, float((gl_VertexID & 2) << 1) - 1.0); vec4 a = uIVP * vec4(aP, 1.0, 1.0); vD = a.xyz / a.w; gl_Position = vec4(aP, 0.5, 1.0); }";
const VS2: &str = "attribute vec2 aP; uniform mat4 uIVP; varying vec3 vD;\nvoid main(){ vec4 a = uIVP * vec4(aP, 1.0, 1.0); vD = a.xyz / a.w; gl_Position = vec4(aP, 0.5, 1.0); }";
fn fs3(q: &Cal) -> String {
    format!("#version 300 es\n{}precision highp float; precision highp sampler3D;\nin vec3 vD;\n{UNIFORMES}uniform sampler3D uRu;\nlayout(location = 0) out vec4 o;\nlayout(location = 1) out vec4 oD;\n#define TEX3(q) texture(uRu, q)\n#define SALIDA_COLOR(x) o = x\n#define SALIDA_DIST(x) oD = x\n{CUERPO}", defines(q))
}
fn fs2(q: &Cal) -> String {
    // (el ruido del mosaico: dos lecturas —las dos capas de alrededor— mezcladas; adentro de cada capa, lineal)
    format!("{}precision highp float;\nvarying vec3 vD;\n{UNIFORMES}uniform sampler2D uRu;\nvec4 tex3(vec3 q) {{\n  q = fract(q); float z = q.z * 64.0 - 0.5, z0 = floor(z), f = z - z0;\n  float s0 = mod(z0 + 64.0, 64.0), s1 = mod(z0 + 1.0, 64.0); vec2 uv = clamp(q.xy, 0.5 / 64.0, 63.5 / 64.0);\n  return mix(texture2D(uRu, (vec2(mod(s0, 8.0), floor(s0 / 8.0)) + uv) * 0.125), texture2D(uRu, (vec2(mod(s1, 8.0), floor(s1 / 8.0)) + uv) * 0.125), f);\n}}\n#define TEX3(q) tex3(q)\n#define SALIDA_COLOR(x) gl_FragColor = x\n#define SALIDA_DIST(x)\n{CUERPO}", defines(q))
}
/// el pegado sobre la escena (FS_NVC en 8 bits): OpenGL 3 con la profundidad de donde entra el rayo
const FS_PEGAR3: &str = "#version 300 es\nprecision highp float; in vec3 vD;\nuniform sampler2D uCol, uDist; uniform mat4 uVP; uniform vec3 uCam; uniform vec2 uInv;\nout vec4 o;\nvoid main(){\n  vec2 uv = gl_FragCoord.xy * uInv; vec4 c = texture(uCol, uv);\n  if (c.a < 0.004) discard;\n  vec2 dd = texture(uDist, uv).rg; float d = (dd.x + dd.y / 255.0) * 16384.0;\n  vec4 cl = uVP * vec4(uCam + normalize(vD - uCam) * d, 1.0);\n  gl_FragDepth = clamp(cl.z / cl.w * 0.5 + 0.5, 0.0, 0.99998);\n  o = c;\n}";
/// OpenGL 2: a la profundidad del frente del hongo (uZ)
const VS_PEGAR2: &str = "attribute vec2 aP; uniform float uZ; void main(){ gl_Position = vec4(aP, uZ, 1.0); }";
const FS_PEGAR2: &str = "precision mediump float; uniform sampler2D uCol; uniform vec2 uInv;\nvoid main(){ vec4 c = texture2D(uCol, gl_FragCoord.xy * uInv); if (c.a < 0.004) discard; gl_FragColor = c; }";

/// un hongo para dibujar en este cuadro: su bloque, el centro y el radio de su caja, la distancia, cuánto de la pantalla
/// tapa, su tamaño en la pantalla y el rectángulo donde cae (0..1; None: toda)
pub struct Plan { pub b: Vec<f32>, pub c: [f32; 3], pub r: f32, pub d: f32, pub tapa: f32, pub ry: f32, pub rect: Option<[f32; 4]> }
/// nvElegir: los que se ven (sin el plano lejano: un hongo se ve de mucho más lejos que el mapa), de la más cercana a la
/// más lejana, hasta `n`; `hw`: alto / ancho de la pantalla
pub fn elegir(c: &Cuadro, n: usize, hw: f32) -> Vec<Plan> {
    let pl = mat::planos(&c.vp); let vp = &c.vp; let p11 = (vp[1] * vp[1] + vp[5] * vp[5] + vp[9] * vp[9]).sqrt().max(1e-3);
    let mut l: Vec<Plan> = vec![];
    for (t, b) in &c.efectos {
        if *t != EF_HONGO || b.len() < 28 { continue; }
        let s = b[3]; let (cx, cy) = (b[24], b[25]); let r = (cx * cx + cy * cy * 0.25).sqrt() * s; let cc = [b[0], b[1] + cy * 0.5 * s, b[2]];
        if !(0..5).all(|i| pl[i][0] * cc[0] + pl[i][1] * cc[1] + pl[i][2] * cc[2] + pl[i][3] >= -r) { continue; }
        let d = mat::punto(mat::sub(cc, c.pos), mat::sub(cc, c.pos)).sqrt();
        let ry = if d <= r { 9.0 } else { r / (d * d - r * r).sqrt() * p11 };
        let tapa = (std::f32::consts::PI * ry * ry * hw / 4.0).min(1.0);
        // (el rectángulo de la pantalla donde cae, con margen: las dos pasadas sólo ahí; de cerca, toda)
        let mut rect = None;
        if d > r * 1.15 {
            let x = vp[0] * cc[0] + vp[4] * cc[1] + vp[8] * cc[2] + vp[12]; let y = vp[1] * cc[0] + vp[5] * cc[1] + vp[9] * cc[2] + vp[13]; let w = vp[3] * cc[0] + vp[7] * cc[1] + vp[11] * cc[2] + vp[15];
            if w > 0.0 { let ry2 = ry * 1.3; let rx = ry2 * hw; let (nx, ny) = (x / w, y / w);
                let q = [((nx - rx) * 0.5 + 0.5).clamp(0.0, 1.0), ((ny - ry2) * 0.5 + 0.5).clamp(0.0, 1.0), ((nx + rx) * 0.5 + 0.5).clamp(0.0, 1.0), ((ny + ry2) * 0.5 + 0.5).clamp(0.0, 1.0)];
                if q[2] <= q[0] || q[3] <= q[1] { continue; } rect = Some(q); }
        }
        l.push(Plan { b: b.clone(), c: cc, r, d, tapa, ry, rect });
    }
    l.sort_by(|a, b| a.d.total_cmp(&b.d)); l.truncate(n);
    l
}

/// el que dibuja los hongos (OpenGL 3 o 2): el ruido (armado en otro hilo al empezar: unos cientos de ms), los programas de
/// cada calidad, el pegado y el búfer chico (cuadro, color, distancia, ancho, alto)
pub struct Hongos {
    es3: bool, hilo: Option<mpsc::Receiver<Vec<u8>>>, tex: Option<glow::Texture>, progs: HashMap<u32, glow::Program>, pegar: Option<glow::Program>,
    fb: Option<(glow::Framebuffer, glow::Texture, Option<glow::Texture>, i32, i32)>, tri: Option<glow::Buffer>,
    /// si no se puede (la placa no compiló o no arma el búfer): carteles
    pub no: bool, pub err: String,
    /// lo que tardó el último cuadro con hongos (para el perfil)
    pub ms: f32,
}
impl Hongos {
    pub fn nuevo(es3: bool) -> Hongos {
        let (tx, rx) = mpsc::channel();
        let _ = std::thread::Builder::new().name("ruido_hongo".into()).spawn(move || { let _ = tx.send(ruido()); });
        Hongos { es3, hilo: Some(rx), tex: None, progs: HashMap::new(), pegar: None, fb: None, tri: None, no: false, err: String::new(), ms: 0.0 }
    }
    /// si ya puede dibujar con volumen (el ruido listo y la placa sin problemas)
    pub fn listo(&self) -> bool { !self.no && (self.tex.is_some() || self.hilo.is_some()) }
    unsafe fn ruido_listo(&mut self, gl: &glow::Context) -> bool {
        if self.tex.is_some() { return true; }
        let Some(rx) = self.hilo.as_ref() else { return false };
        let Ok(v) = rx.try_recv() else { return false };
        self.hilo = None;
        let Ok(t) = gl.create_texture() else { self.no = true; return false };
        gl.pixel_store_i32(glow::UNPACK_ALIGNMENT, 1);
        if self.es3 {
            gl.bind_texture(glow::TEXTURE_3D, Some(t));
            gl.tex_image_3d(glow::TEXTURE_3D, 0, glow::RGBA8 as i32, N as i32, N as i32, N as i32, 0, glow::RGBA, glow::UNSIGNED_BYTE, glow::PixelUnpackData::Slice(Some(&v)));
            for (k, x) in [(glow::TEXTURE_MIN_FILTER, glow::LINEAR), (glow::TEXTURE_MAG_FILTER, glow::LINEAR), (glow::TEXTURE_WRAP_S, glow::REPEAT), (glow::TEXTURE_WRAP_T, glow::REPEAT), (glow::TEXTURE_WRAP_R, glow::REPEAT)] { gl.tex_parameter_i32(glow::TEXTURE_3D, k, x as i32); }
            gl.bind_texture(glow::TEXTURE_3D, None);
        } else {
            let m = mosaico(&v); gl.bind_texture(glow::TEXTURE_2D, Some(t));
            gl.tex_image_2d(glow::TEXTURE_2D, 0, glow::RGBA as i32, 512, 512, 0, glow::RGBA, glow::UNSIGNED_BYTE, glow::PixelUnpackData::Slice(Some(&m)));
            for (k, x) in [(glow::TEXTURE_MIN_FILTER, glow::LINEAR), (glow::TEXTURE_MAG_FILTER, glow::LINEAR), (glow::TEXTURE_WRAP_S, glow::CLAMP_TO_EDGE), (glow::TEXTURE_WRAP_T, glow::CLAMP_TO_EDGE)] { gl.tex_parameter_i32(glow::TEXTURE_2D, k, x as i32); }
        }
        gl.pixel_store_i32(glow::UNPACK_ALIGNMENT, 4);
        self.tex = Some(t); true
    }
    unsafe fn compilar(&mut self, gl: &glow::Context, vs: &str, fs: &str) -> Option<glow::Program> {
        let p = gl.create_program().ok()?; let mut ss = vec![];
        for (t, src) in [(glow::VERTEX_SHADER, vs), (glow::FRAGMENT_SHADER, fs)] {
            let s = gl.create_shader(t).ok()?; gl.shader_source(s, src); gl.compile_shader(s);
            if !gl.get_shader_compile_status(s) { self.err = gl.get_shader_info_log(s).chars().take(400).collect(); eprintln!("hongo: {}", self.err); self.no = true; return None; }
            gl.attach_shader(p, s); ss.push(s);
        }
        gl.bind_attrib_location(p, 0, "aP"); gl.link_program(p);
        if !gl.get_program_link_status(p) { self.err = gl.get_program_info_log(p).chars().take(400).collect(); eprintln!("hongo: {}", self.err); self.no = true; return None; }
        for s in ss { gl.detach_shader(p, s); gl.delete_shader(s); }
        Some(p)
    }
    unsafe fn bufer(&mut self, gl: &glow::Context, w: i32, h: i32) -> bool {
        if self.fb.as_ref().map_or(false, |f| f.3 == w && f.4 == h) { return true; }
        if let Some((f, c, d, _, _)) = self.fb.take() { gl.delete_framebuffer(f); gl.delete_texture(c); if let Some(d) = d { gl.delete_texture(d); } }
        let tx = |filtro: u32| -> Option<glow::Texture> {
            let t = gl.create_texture().ok()?; gl.bind_texture(glow::TEXTURE_2D, Some(t));
            gl.tex_image_2d(glow::TEXTURE_2D, 0, glow::RGBA as i32, w, h, 0, glow::RGBA, glow::UNSIGNED_BYTE, glow::PixelUnpackData::Slice(None));
            for (k, x) in [(glow::TEXTURE_MIN_FILTER, filtro), (glow::TEXTURE_MAG_FILTER, filtro), (glow::TEXTURE_WRAP_S, glow::CLAMP_TO_EDGE), (glow::TEXTURE_WRAP_T, glow::CLAMP_TO_EDGE)] { gl.tex_parameter_i32(glow::TEXTURE_2D, k, x as i32); }
            Some(t)
        };
        let (Some(c), Ok(f)) = (tx(glow::LINEAR), gl.create_framebuffer()) else { self.no = true; return false };
        let d = if self.es3 { tx(glow::NEAREST) } else { None };
        gl.bind_framebuffer(glow::FRAMEBUFFER, Some(f)); gl.framebuffer_texture_2d(glow::FRAMEBUFFER, glow::COLOR_ATTACHMENT0, glow::TEXTURE_2D, Some(c), 0);
        if let Some(d) = d { gl.framebuffer_texture_2d(glow::FRAMEBUFFER, glow::COLOR_ATTACHMENT1, glow::TEXTURE_2D, Some(d), 0); gl.draw_buffers(&[glow::COLOR_ATTACHMENT0, glow::COLOR_ATTACHMENT1]); }
        let ok = gl.check_framebuffer_status(glow::FRAMEBUFFER) == glow::FRAMEBUFFER_COMPLETE;
        self.fb = Some((f, c, d, w, h)); if !ok { self.no = true; self.err = "el búfer chico no anda".into(); }
        ok
    }
    unsafe fn triangulo(&mut self, gl: &glow::Context) {
        if self.es3 { gl.bind_vertex_array(None); return; }
        if self.tri.is_none() { if let Ok(b) = gl.create_buffer() { gl.bind_buffer(glow::ARRAY_BUFFER, Some(b)); let v: [f32; 6] = [-1.0, -1.0, 3.0, -1.0, -1.0, 3.0]; let by: Vec<u8> = v.iter().flat_map(|x| x.to_le_bytes()).collect(); gl.buffer_data_u8_slice(glow::ARRAY_BUFFER, &by, glow::STATIC_DRAW); self.tri = Some(b); } }
        gl.bind_buffer(glow::ARRAY_BUFFER, self.tri); gl.enable_vertex_attrib_array(0); gl.vertex_attrib_pointer_f32(0, 2, glow::FLOAT, false, 8, 0);
        for a in 1..6 { gl.disable_vertex_attrib_array(a); }
    }
    /// dibuja los hongos del cuadro sobre la escena (el destino `fb`, de `w` × `h`, con su profundidad ya dibujada): de la más
    /// lejana a la más cercana. `cal` la calidad del juego. Devuelve cuántos dibujó (con 0, el juego sigue con carteles)
    pub unsafe fn dibujar(&mut self, gl: &glow::Context, c: &Cuadro, cal: u8, fb: Option<glow::Framebuffer>, w: i32, h: i32) -> usize {
        let Some(q) = calidad(cal) else { return 0 };
        if self.no || !c.efectos.iter().any(|e| e.0 == EF_HONGO) || !self.ruido_listo(gl) { return 0; }
        let t0 = std::time::Instant::now();
        let clave = q.pasos;
        if !self.progs.contains_key(&clave) { let fs = if self.es3 { fs3(&q) } else { fs2(&q) }; let vs = if self.es3 { VS3 } else { VS2 }; match self.compilar(gl, vs, &fs) { Some(p) => { self.progs.insert(clave, p); } None => return 0 } }
        if self.pegar.is_none() { let p = if self.es3 { self.compilar(gl, VS3, FS_PEGAR3) } else { self.compilar(gl, VS_PEGAR2, FS_PEGAR2) }; match p { Some(p) => self.pegar = Some(p), None => return 0 } }
        let l = elegir(c, q.n, h as f32 / w as f32); if l.is_empty() { return 0; }
        let ivp = mat::inv(&c.vp); let luz = &c.luz;
        let mut hechos = 0;
        for pl in l.iter().rev() {
            // (el búfer chico, más chico cuando el hongo llena la pantalla: es humo, suave, y así no cuesta tanto)
            let k = (q.esc * (0.15 / pl.tapa.max(1e-3)).sqrt().clamp(0.6, 1.0)).min(q.max / w as f32);
            let (bw, bh) = (((w as f32 * k).round() as i32).max(16), ((h as f32 * k).round() as i32).max(16));
            if !self.bufer(gl, bw, bh) { return hechos; }
            let (f, col, dist, ..) = *self.fb.as_ref().unwrap();
            let tijera = |ancho: i32, alto: i32| match pl.rect {
                None => gl.disable(glow::SCISSOR_TEST),
                Some(r) => { gl.enable(glow::SCISSOR_TEST); let (x0, y0) = ((r[0] * ancho as f32).floor() as i32, (r[1] * alto as f32).floor() as i32); gl.scissor(x0, y0, (r[2] * ancho as f32).ceil() as i32 - x0 + 1, (r[3] * alto as f32).ceil() as i32 - y0 + 1); }
            };
            // 1) el humo en el búfer chico
            gl.bind_framebuffer(glow::FRAMEBUFFER, Some(f)); gl.viewport(0, 0, bw, bh);
            gl.disable(glow::SCISSOR_TEST); gl.clear_color(0.0, 0.0, 0.0, 0.0); gl.clear(glow::COLOR_BUFFER_BIT);
            if self.es3 && dist.is_some() { gl.clear_buffer_f32_slice(glow::COLOR, 1, &[1.0, 1.0, 0.0, 1.0]); }
            tijera(bw, bh);
            gl.disable(glow::DEPTH_TEST); gl.disable(glow::BLEND); gl.depth_mask(false); gl.disable(glow::CULL_FACE);
            let p = self.progs[&clave]; gl.use_program(Some(p));
            let u = |n: &str| gl.get_uniform_location(p, n);
            let b = &pl.b; let agua = b[27] > 0.5; let (sk, ak) = (0.9, 1.6);
            gl.uniform_matrix_4_f32_slice(u("uIVP").as_ref(), false, &ivp);
            gl.uniform_3_f32(u("uCam").as_ref(), c.pos[0], c.pos[1], c.pos[2]); gl.uniform_3_f32(u("uO").as_ref(), b[0], b[1], b[2]); gl.uniform_1_f32(u("uEsc").as_ref(), b[3]);
            let s = mat::norm(luz.sol); gl.uniform_3_f32(u("uSol").as_ref(), s[0], s[1], s[2]);
            gl.uniform_3_f32(u("uSolC").as_ref(), luz.sol_c[0] * sk, luz.sol_c[1] * sk, luz.sol_c[2] * sk);
            gl.uniform_3_f32(u("uAmbS").as_ref(), luz.amb_s[0] * ak, luz.amb_s[1] * ak, luz.amb_s[2] * ak); gl.uniform_3_f32(u("uAmbG").as_ref(), luz.amb_g[0] * ak, luz.amb_g[1] * ak, luz.amb_g[2] * ak);
            // (la niebla sobre el hongo empieza donde termina la del mapa y llega a lo sumo al 60 %: se ve de lejos, con bruma)
            gl.uniform_3_f32(u("uNieC").as_ref(), luz.nie.c[0], luz.nie.c[1], luz.nie.c[2]); gl.uniform_1_f32(u("uNieA").as_ref(), luz.nie.b); gl.uniform_1_f32(u("uNieB").as_ref(), luz.nie.b + 2500.0); gl.uniform_1_f32(u("uNieK").as_ref(), 0.6);
            let (ah, at, af) = if agua { ([0.86, 0.87, 0.9], [0.88, 0.89, 0.92], [0.9, 0.91, 0.94]) } else { ([0.5, 0.4, 0.35], [0.48, 0.39, 0.32], [0.55, 0.46, 0.38]) };
            gl.uniform_3_f32(u("uAlbH").as_ref(), ah[0], ah[1], ah[2]); gl.uniform_3_f32(u("uAlbT").as_ref(), at[0], at[1], at[2]); gl.uniform_3_f32(u("uAlbF").as_ref(), af[0], af[1], af[2]);
            gl.uniform_1_f32(u("uSem").as_ref(), b[26]); gl.uniform_1_f32(u("uExpo").as_ref(), luz.expo);
            for (k, nm) in ["uCap", "uTallo", "uFalda", "uFuego", "uDens"].iter().enumerate() { gl.uniform_4_f32(u(nm).as_ref(), b[4 + k * 4], b[5 + k * 4], b[6 + k * 4], b[7 + k * 4]); }
            gl.uniform_2_f32(u("uCaja").as_ref(), b[24], b[25]);
            gl.active_texture(glow::TEXTURE0); gl.bind_texture(if self.es3 { glow::TEXTURE_3D } else { glow::TEXTURE_2D }, self.tex); gl.uniform_1_i32(u("uRu").as_ref(), 0);
            self.triangulo(gl); gl.draw_arrays(glow::TRIANGLES, 0, 3);
            if self.es3 { gl.bind_texture(glow::TEXTURE_3D, None); }
            // 2) pegarlo en la escena
            gl.bind_framebuffer(glow::FRAMEBUFFER, fb); gl.viewport(0, 0, w, h); tijera(w, h);
            let p = self.pegar.unwrap(); gl.use_program(Some(p)); let u = |n: &str| gl.get_uniform_location(p, n);
            gl.uniform_2_f32(u("uInv").as_ref(), 1.0 / w as f32, 1.0 / h as f32);
            gl.active_texture(glow::TEXTURE0); gl.bind_texture(glow::TEXTURE_2D, Some(col)); gl.uniform_1_i32(u("uCol").as_ref(), 0);
            if self.es3 {
                gl.uniform_matrix_4_f32_slice(u("uIVP").as_ref(), false, &ivp); gl.uniform_matrix_4_f32_slice(u("uVP").as_ref(), false, &c.vp); gl.uniform_3_f32(u("uCam").as_ref(), c.pos[0], c.pos[1], c.pos[2]);
                gl.active_texture(glow::TEXTURE1); gl.bind_texture(glow::TEXTURE_2D, dist); gl.uniform_1_i32(u("uDist").as_ref(), 1); gl.active_texture(glow::TEXTURE0);
            } else {
                // (sin gl_FragDepth: a la profundidad del frente del hongo —lo que está más cerca lo tapa—)
                let dd = (pl.d - pl.r * 0.55).max(1.0); let fw = mat::norm([c.vp[3], c.vp[7], c.vp[11]]); let pp = [c.pos[0] + fw[0] * dd, c.pos[1] + fw[1] * dd, c.pos[2] + fw[2] * dd];
                let v = &c.vp; let z = v[2] * pp[0] + v[6] * pp[1] + v[10] * pp[2] + v[14]; let ww = v[3] * pp[0] + v[7] * pp[1] + v[11] * pp[2] + v[15];
                gl.uniform_1_f32(u("uZ").as_ref(), if ww > 1e-4 { (z / ww).clamp(-1.0, 0.99998) } else { -1.0 });
            }
            gl.enable(glow::DEPTH_TEST); gl.depth_func(glow::LEQUAL); gl.depth_mask(false); gl.enable(glow::BLEND); gl.blend_func(glow::ONE, glow::ONE_MINUS_SRC_ALPHA);
            self.triangulo(gl); gl.draw_arrays(glow::TRIANGLES, 0, 3);
            gl.disable(glow::BLEND); gl.depth_mask(true); gl.disable(glow::SCISSOR_TEST);
            hechos += 1;
        }
        gl.active_texture(glow::TEXTURE0);
        self.ms = t0.elapsed().as_secs_f32() * 1000.0;
        hechos
    }
}

#[cfg(test)]
mod pruebas {
    use super::*;
    #[test]
    fn el_ruido_del_trailer() {
        let v = ruido(); assert_eq!(v.len(), N * N * N * 4);
        // (los canales llenan el rango y no son constantes)
        for k in 0..4 { let (mn, mx) = v.iter().skip(k).step_by(4).fold((255u8, 0u8), |a, &x| (a.0.min(x), a.1.max(x))); assert!(mx - mn > 120, "canal {k}: {mn}..{mx}"); }
        let m = mosaico(&v); assert_eq!(&m[0..4], &v[0..4]); let z = 9; let (tx, ty) = (z % 8, z / 8); assert_eq!(&m[((ty * 64) * 512 + tx * 64) * 4..][..4], &v[(z * 64 * 64) * 4..][..4]);
    }
}
