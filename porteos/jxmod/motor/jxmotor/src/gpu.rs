//! El dibujo nativo (GLES 3.0) de lo que manda el juego:
//!  - recursos que llegan de a poco (mallas, texturas, luces horneadas, materiales y el agua), cada uno con su número del
//!    juego, y un cuadro aparte (cámara, sol, luces y la lista de lo que se dibuja con sus matrices y huesos);
//!  - la luz del juego: sol con sombra (mapa de profundidad del sol, 3×3 muestras), cielo y suelo, luz horneada de los mapas
//!    de Source, luces puntuales y especiales (linternas), niebla y el tono de pantalla (ACES), como el sombreador de WebGL;
//!  - los personajes con huesos (la piel en la placa, 56 huesos como en WebGL);
//!  - el agua de Half-Life 2: su mapa de normales en dos capas, Fresnel, el reflejo de la escena y lo turbio por lo hondo;
//!  - recorte por lo que ve la cámara (y por lo que ve el sol para la sombra) con la esfera de cada cosa;
//!  - resolución dinámica: la escena a una fracción del tamaño de la pantalla y estirada al final (lo que más pesa en una
//!    placa floja son los píxeles), y la sombra y el reflejo rehechos cada tantos cuadros.
use crate::escena::{Agua, Cuadro, Escena, ItemDin, Mat, FL_SIN_SOMBRA};
use crate::mat::{self, M4};
use glow::HasContext;
use std::collections::HashMap;

#[derive(Clone, Debug)]
pub struct Opciones {
    /// fracción del tamaño de la pantalla a la que se dibuja la escena (0,5 = la cuarta parte de los píxeles)
    pub escala: f32,
    pub sombras: bool, pub sombra_px: i32, pub sombra_cada: u32, pub sombra_radio: f32,
    pub reflejo: bool, pub reflejo_div: i32, pub reflejo_cada: u32,
}
impl Default for Opciones {
    fn default() -> Self { Opciones { escala: 1.0, sombras: true, sombra_px: 2048, sombra_cada: 1, sombra_radio: 45.0, reflejo: true, reflejo_div: 2, reflejo_cada: 1 } }
}
impl Opciones {
    /// lo que se elige para un celular de 1 GB con una placa floja: dos tercios de la resolución, sombra de 1024 cada 2
    /// cuadros y reflejo a un cuarto cada 2
    pub fn celular_flojo() -> Self { Opciones { escala: 0.67, sombras: true, sombra_px: 1024, sombra_cada: 2, sombra_radio: 35.0, reflejo: true, reflejo_div: 4, reflejo_cada: 2 } }
}

struct MallaGL { vao: glow::VertexArray, bufs: Vec<glow::Buffer>, i32: bool, mn: [f32; 3], sc: [f32; 3], lm: i64, piel: bool, bytes: usize }
struct TexGL { t: glow::Texture, bytes: usize }
struct Destino { fb: glow::Framebuffer, color: glow::Texture, prof: Option<glow::Renderbuffer>, w: i32, h: i32 }

// los uniformes, por número (buscarlos por nombre en cada dibujo cuesta)
#[derive(Clone, Copy)]
enum U { Sesgo, VP, M, SVP, Mn, Sc, St, C, Em, Modo, S1, S3, Sol, SolC, AmbS, AmbG, NieC, Nie, Cam, Expo, Sombra, Clip, B, LP, LC, LD, LN, LE, F, H, S, Bq, D, RefInv, Tiempo, IVP }
const NU: usize = U::IVP as usize + 1;
const NOMBRES: [&str; NU] = ["uSesgo", "uVP", "uM", "uSVP", "uMn", "uSc", "uSt", "uC", "uEm", "uModo", "uS1", "uS3", "uSol", "uSolC", "uAmbS", "uAmbG", "uNieC", "uNie", "uCam", "uExpo", "uSombra", "uClip", "uB", "uLP", "uLC", "uLD", "uLN", "uLE", "uF", "uH", "uS", "uBq", "uD", "uRefInv", "uTiempo", "uIVP"];
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
uniform mat4 uVP, uM, uSVP; uniform vec3 uMn, uSc; uniform vec4 uSt; uniform vec2 uSesgo;
out vec3 vW; out vec3 vN; out vec2 vU; out vec2 vL; out vec4 vS; out float vMz;
void main() {
  vec3 p = uMn + aP * uSc, n = aN.xyz;
#ifdef PIEL
  vec4 r0 = vec4(0.0), r1 = vec4(0.0), r2 = vec4(0.0);
  for (int k = 0; k < 4; k++) { int j = int(aJ[k]) * 3; float w = aW[k]; r0 += uB[j] * w; r1 += uB[j + 1] * w; r2 += uB[j + 2] * w; }
  vec4 q = vec4(p, 1.0); p = vec3(dot(r0, q), dot(r1, q), dot(r2, q)); n = vec3(dot(r0.xyz, n), dot(r1.xyz, n), dot(r2.xyz, n));
#endif
  vec4 w = uM * vec4(p, 1.0);
  vMz = aN.w; vW = w.xyz; vN = mat3(uM) * n; vU = aU * uSt.xy + uSt.zw; vL = aL;
  // (la sombra se lee corrida por la normal un píxel y medio de la sombra: sin acné y sin despegar la sombra de lo que toca)
  vS = uSVP * vec4(w.xyz + normalize(vN + vec3(1e-6)) * uSesgo.y, 1.0);
  gl_Position = uVP * w;
}"#;
const FS_LUZ: &str = r#"#version 300 es
precision highp float; precision highp sampler2DShadow;
uniform sampler2D uT, uLM, uT1, uT2, uT3; uniform vec4 uS1; uniform vec2 uS3; uniform sampler2DShadow uSM;
uniform vec4 uC; uniform vec3 uSol, uSolC, uAmbS, uAmbG, uNieC, uCam, uEm; uniform vec2 uNie, uSesgo; uniform float uExpo, uSombra, uClip; uniform int uModo;
uniform vec4 uLP[12], uLC[12], uLD[12]; uniform int uLN, uLE;
in vec3 vW; in vec3 vN; in vec2 vU; in vec2 vL; in vec4 vS; in float vMz; out vec4 o;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
float sombra(float nd) {
  if (uSombra < 0.5) return 1.0;
  vec3 q = vS.xyz / vS.w * 0.5 + 0.5;
  if (q.x <= 0.0 || q.y <= 0.0 || q.x >= 1.0 || q.y >= 1.0 || q.z >= 1.0) return 1.0;
  vec2 t = 1.0 / vec2(textureSize(uSM, 0)); float b = uSesgo.x * (1.0 + 2.0 * (1.0 - nd)), s = 0.0;
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) s += texture(uSM, vec3(q.xy + vec2(i, j) * t, q.z - b));
  return s / 9.0;
}
void main() {
  if (vW.y < uClip) discard;   // (el reflejo: sólo lo de arriba del agua)
  vec4 t;
  if ((uModo & 16) != 0) { vec4 kc = texture(uT, vU); t = vec4(texture(uT1, vU * uS1.xy).rgb * kc.r + texture(uT2, vU * uS1.zw).rgb * kc.g + texture(uT3, vU * uS3).rgb * kc.b, 1.0); }   // (terreno: control y tres capas)
  else if ((uModo & 8) != 0) t = mix(texture(uT, vU), texture(uT1, vU), clamp(vMz, 0.0, 1.0));   // (dos texturas mezcladas por vértice)
  else t = texture(uT, vU);
  t *= uC;
  if ((uModo & 2) != 0 && t.a < 0.5) discard;
  vec3 alb = pow(t.rgb, vec3(2.2)), n = normalize(vN), luz;
  if (!gl_FrontFacing && (uModo & 32) != 0) n = -n;
  float nd = max(dot(n, uSol), 0.0);
  if ((uModo & 4) != 0) luz = vec3(1.4);
  else if ((uModo & 1) != 0) luz = pow(texture(uLM, vL).rgb, vec3(2.2)) * 4.0 * mix(0.6, 1.0, sombra(nd));
  else luz = mix(uAmbG, uAmbS, n.y * 0.5 + 0.5) + uSolC * nd * sombra(nd);
  if ((uModo & 4) == 0) for (int i = 0; i < 12; i++) {
    if (i >= uLN) break;
    vec3 L = uLP[i].xyz - vW; float d2 = dot(L, L), r = uLP[i].w;
    if (d2 > r * r) continue;
    float d = sqrt(d2); L /= d;
    float at = i < uLE ? pow(clamp(1.0 - pow(d / r, 4.0), 0.0, 1.0), 2.0) / (d2 + 1.0) : pow(1.0 - d / r, 1.2) / (1.0 + 0.012 * d2);
    if (uLD[i].w > -1.0) at *= smoothstep(uLD[i].w, uLD[i].w + 0.08 + uLC[i].w, dot(-L, uLD[i].xyz));
    luz += uLC[i].rgb * at * (i < uLE ? max(dot(n, L), 0.0) : max(dot(n, L) * 0.75 + 0.25, 0.0));
  }
  vec3 col = alb * luz + uEm;
  float f = clamp((distance(vW, uCam) - uNie.x) / max(uNie.y - uNie.x, 0.001), 0.0, 1.0);
  col = mix(col, uNieC, f);
  o = vec4(pow(aces(col * uExpo), vec3(1.0 / 2.2)), t.a);
}"#;
const VS_SOMBRA: &str = r#"#version 300 es
layout(location = 0) in vec3 aP;
#ifdef PIEL
layout(location = 3) in vec4 aJ; layout(location = 4) in vec4 aW; uniform vec4 uB[168];
#endif
uniform mat4 uVP, uM; uniform vec3 uMn, uSc;
void main() {
  vec3 p = uMn + aP * uSc;
#ifdef PIEL
  vec4 r0 = vec4(0.0), r1 = vec4(0.0), r2 = vec4(0.0);
  for (int k = 0; k < 4; k++) { int j = int(aJ[k]) * 3; float w = aW[k]; r0 += uB[j] * w; r1 += uB[j + 1] * w; r2 += uB[j + 2] * w; }
  vec4 q = vec4(p, 1.0); p = vec3(dot(r0, q), dot(r1, q), dot(r2, q));
#endif
  gl_Position = uVP * uM * vec4(p, 1.0);
}"#;
const FS_SOMBRA: &str = r#"#version 300 es
precision mediump float; out vec4 o; void main() { o = vec4(1.0); }"#;
const FS_AGUA: &str = r#"#version 300 es
precision highp float;
uniform sampler2D uN, uRef, uP;
uniform vec4 uF, uH, uS, uBq; uniform vec2 uD, uRefInv; uniform float uTiempo, uExpo;
uniform vec3 uSol, uSolC, uAmbS, uAmbG, uCam;
in vec3 vW; in vec3 vN; in vec2 vU; in vec2 vL; in vec4 vS; in float vMz; out vec4 o;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main() {
  float dCam = distance(vW, uCam); vec3 v = normalize(uCam - vW);
  vec2 q = vW.xz * uH.x;
  vec3 n1 = texture(uN, q + uTiempo * uS.xy).rgb * 2.0 - 1.0, n2 = texture(uN, q * 0.71 + vec2(0.37, 0.61) + uTiempo * uS.zw).rgb * 2.0 - 1.0;
  vec2 d = (n1.xy + n2.xy) * uH.y / (1.0 + dCam * 0.012);
  vec3 n = normalize(vec3(d.x, 1.0, d.y));
  float fr = 0.02 + 0.98 * pow(1.0 - abs(dot(n, v)), 5.0);
  vec3 cuerpo = pow(aces(uF.rgb * (mix(uAmbG, uAmbS, 0.8) + uSolC * max(uSol.y, 0.0) * 0.5) * 1.6 * uExpo), vec3(1.0 / 2.2));
  vec3 refl = uH.w > 0.5 ? texture(uRef, gl_FragCoord.xy * uRefInv + n.xz * uH.z / (1.0 + dCam * 0.02)).rgb : mix(cuerpo, vec3(0.75, 0.82, 0.9), 0.6);
  // (el brillo del sol: con la normal suavizada —la del mapa de normales a toda fuerza hace puntitos que titilan— y ancho)
  vec3 ns = normalize(vec3(d.x * 0.35, 1.0, d.y * 0.35));
  float rv = max(dot(reflect(-v, ns), uSol), 0.0), sp = pow(rv, 220.0) * 1.2 * step(0.0, uSol.y);
  vec3 col = mix(cuerpo, refl, fr) + uSolC * sp;
  vec2 pb = (vW.xz - uBq.xy) * uBq.zw;
  float prof = (pb.x >= 0.0 && pb.y >= 0.0 && pb.x <= 1.0 && pb.y <= 1.0) ? texture(uP, pb).r * uD.x : uD.x;
  float niebla = 1.0 - exp(-prof / max(abs(v.y), 0.08) / uD.y);
  o = vec4(col, mix(max(niebla, uF.a * 0.25), 1.0, fr));
}"#;
const VS_CIELO: &str = r#"#version 300 es
out vec2 vP; void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)) * 2.0 - 1.0; vP = p; gl_Position = vec4(p, 0.9999, 1.0); }"#;
const FS_CIELO: &str = r#"#version 300 es
precision highp float; uniform mat4 uIVP; uniform vec3 uSol, uNieC; uniform float uExpo; in vec2 vP; out vec4 o;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main() {
  vec4 a = uIVP * vec4(vP, -1.0, 1.0), b = uIVP * vec4(vP, 1.0, 1.0); vec3 d = normalize(b.xyz / b.w - a.xyz / a.w);
  vec3 cen = vec3(0.16, 0.36, 0.78), hor = vec3(0.62, 0.74, 0.88);
  vec3 c = mix(hor, cen, pow(clamp(d.y, 0.0, 1.0), 0.45)); if (d.y < 0.0) c = mix(hor, uNieC, clamp(-d.y * 4.0, 0.0, 1.0));
  c += vec3(1.0, 0.92, 0.75) * pow(max(dot(d, uSol), 0.0), 600.0) * 6.0;
  o = vec4(pow(aces(c * uExpo * 1.1), vec3(1.0 / 2.2)), 1.0);
}"#;

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
    for (n, unidad) in [("uT", 0), ("uLM", 1), ("uSM", 2), ("uN", 0), ("uRef", 3), ("uP", 4), ("uT1", 5), ("uT2", 6), ("uT3", 7)] { if let Some(l) = gl.get_uniform_location(p, n) { gl.uniform_1_i32(Some(&l), unidad); } }
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
unsafe fn destino(gl: &glow::Context, w: i32, h: i32) -> Destino {
    let color = gl.create_texture().unwrap(); gl.bind_texture(glow::TEXTURE_2D, Some(color));
    gl.tex_storage_2d(glow::TEXTURE_2D, 1, glow::RGBA8, w, h);
    gl.tex_parameter_i32(glow::TEXTURE_2D, glow::TEXTURE_MIN_FILTER, glow::LINEAR as i32); gl.tex_parameter_i32(glow::TEXTURE_2D, glow::TEXTURE_MAG_FILTER, glow::LINEAR as i32);
    gl.tex_parameter_i32(glow::TEXTURE_2D, glow::TEXTURE_WRAP_S, glow::CLAMP_TO_EDGE as i32); gl.tex_parameter_i32(glow::TEXTURE_2D, glow::TEXTURE_WRAP_T, glow::CLAMP_TO_EDGE as i32);
    let rb = gl.create_renderbuffer().unwrap(); gl.bind_renderbuffer(glow::RENDERBUFFER, Some(rb)); gl.renderbuffer_storage(glow::RENDERBUFFER, glow::DEPTH_COMPONENT24, w, h);
    let fb = gl.create_framebuffer().unwrap(); gl.bind_framebuffer(glow::FRAMEBUFFER, Some(fb));
    gl.framebuffer_texture_2d(glow::FRAMEBUFFER, glow::COLOR_ATTACHMENT0, glow::TEXTURE_2D, Some(color), 0);
    gl.framebuffer_renderbuffer(glow::FRAMEBUFFER, glow::DEPTH_ATTACHMENT, glow::RENDERBUFFER, Some(rb));
    Destino { fb, color, prof: Some(rb), w, h }
}
unsafe fn borrar_destino(gl: &glow::Context, d: Destino) { gl.delete_framebuffer(d.fb); gl.delete_texture(d.color); if let Some(r) = d.prof { gl.delete_renderbuffer(r); } }

pub struct Motor {
    pub gl: glow::Context,
    pub op: Opciones,
    mallas: HashMap<i64, MallaGL>,
    mats: HashMap<i64, Mat>,
    texs: HashMap<i64, TexGL>,
    lms: HashMap<i64, TexGL>,
    agua: Option<Agua>, agua_n: Option<glow::Texture>, agua_p: Option<glow::Texture>,
    blanca: glow::Texture,
    p_luz: Prog, p_luz_piel: Prog, p_sombra: Prog, p_sombra_piel: Prog, p_agua: Prog, p_cielo: Prog,
    sombra: Option<(glow::Framebuffer, glow::Texture, i32)>,
    reflejo: Option<Destino>,
    escena_rt: Option<Destino>,
    svp: M4,
    sesgo: [f32; 2],
    /// el cuadro (sin sus cosas, que van en `items`)
    pub c: Option<Cuadro>,
    items: Vec<ItemDin>,
    pub cuadro: u64,
    pub dibujos: u32,
    opacos: Vec<usize>, transp: Vec<usize>, aguas: Vec<usize>,
    /// lo que ocupa en la placa (mallas, texturas y luces horneadas), en bytes
    pub memoria: usize,
    pub mapa: String,
}

impl Motor {
    /// arma los sombreadores; los recursos llegan después con `cargar`
    pub unsafe fn nuevo(gl: glow::Context, op: Opciones) -> Result<Motor, String> {
        let p_luz = programa(&gl, VS_LUZ, FS_LUZ, "")?;
        let p_luz_piel = programa(&gl, VS_LUZ, FS_LUZ, "#define PIEL\n")?;
        let p_sombra = programa(&gl, VS_SOMBRA, FS_SOMBRA, "")?;
        let p_sombra_piel = programa(&gl, VS_SOMBRA, FS_SOMBRA, "#define PIEL\n")?;
        let p_agua = programa(&gl, VS_LUZ, FS_AGUA, "")?;
        let p_cielo = programa(&gl, VS_CIELO, FS_CIELO, "")?;
        let blanca = textura(&gl, 1, 1, &[255, 255, 255, 255], true, false);
        Ok(Motor { gl, op, mallas: HashMap::new(), mats: HashMap::new(), texs: HashMap::new(), lms: HashMap::new(), agua: None, agua_n: None, agua_p: None, blanca,
            p_luz, p_luz_piel, p_sombra, p_sombra_piel, p_agua, p_cielo, sombra: None, reflejo: None, escena_rt: None, svp: mat::id(), sesgo: [0.0, 0.0], c: None, items: vec![], cuadro: 0, dibujos: 0,
            opacos: vec![], transp: vec![], aguas: vec![], memoria: 0, mapa: String::new() })
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
        self.mats.clear(); self.agua = None; self.memoria = 0; self.c = None; self.items.clear();
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
        let (mallas, mats) = (&self.mallas, &self.mats);
        let clave = |it: &ItemDin| (!it.h.is_empty() && mallas[&it.m].piel, mats[&it.mat].t, it.m);
        let items = &self.items;
        self.opacos.sort_by_key(|&i| clave(&items[i]));
        // (lo transparente: de lo más lejos a lo más cerca)
        let d2 = |it: &ItemDin| { let e = it.esf; let (x, y, z) = (e[0] - c.pos[0], e[1] - c.pos[1], e[2] - c.pos[2]); x * x + y * y + z * z };
        self.transp.sort_by(|&a, &b| d2(&items[b]).partial_cmp(&d2(&items[a])).unwrap_or(std::cmp::Ordering::Equal));
        self.c = Some(c);
    }

    fn sol(&self) -> [f32; 3] { mat::norm(self.c.as_ref().map(|c| c.luz.sol).unwrap_or([0.3, 0.8, 0.2])) }

    unsafe fn dibujar_item(&self, p: &Prog, it: &ItemDin, conluz: bool) {
        let gl = &self.gl; let Some(m) = self.mallas.get(&it.m) else { return };
        gl.bind_vertex_array(Some(m.vao));
        gl.uniform_matrix_4_f32_slice(p.u(U::M), false, &it.mm);
        gl.uniform_3_f32(p.u(U::Mn), m.mn[0], m.mn[1], m.mn[2]); gl.uniform_3_f32(p.u(U::Sc), m.sc[0], m.sc[1], m.sc[2]);
        if p.piel { let n = it.h.len().min(MAX_HUESOS * 12) / 4 * 4; gl.uniform_4_f32_slice(p.u(U::B), &it.h[..n]); }
        if conluz {
            let Some(mt) = self.mats.get(&it.mat) else { return };
            let tx = |i: i64| self.texs.get(&i).map(|t| t.t).unwrap_or(self.blanca);
            gl.uniform_4_f32(p.u(U::St), mt.st[0], mt.st[1], mt.st[2], mt.st[3]);
            gl.uniform_4_f32(p.u(U::C), mt.c[0], mt.c[1], mt.c[2], mt.c[3]);
            gl.uniform_3_f32(p.u(U::Em), mt.em[0], mt.em[1], mt.em[2]);
            gl.active_texture(glow::TEXTURE0); gl.bind_texture(glow::TEXTURE_2D, Some(tx(mt.t)));
            let lm = self.lms.get(&m.lm);
            if let Some(l) = lm { gl.active_texture(glow::TEXTURE1); gl.bind_texture(glow::TEXTURE_2D, Some(l.t)); }
            let mut modo = (lm.is_some() as i32) | if mt.cut != 0 { 2 } else { 0 } | if mt.unlit != 0 { 4 } else { 0 } | if mt.cut != 0 || mt.blend != 0 { 32 } else { 0 };
            if let Some(tr) = mt.terr.as_ref().filter(|t| t.len() == 3) {
                for (k, c) in tr.iter().enumerate() { gl.active_texture(glow::TEXTURE5 + k as u32); gl.bind_texture(glow::TEXTURE_2D, Some(tx(c.0))); }
                gl.uniform_4_f32(p.u(U::S1), tr[0].1, tr[0].2, tr[1].1, tr[1].2); gl.uniform_2_f32(p.u(U::S3), tr[2].1, tr[2].2); modo |= 16;
            } else if mt.t2 >= 0 { gl.active_texture(glow::TEXTURE5); gl.bind_texture(glow::TEXTURE_2D, Some(tx(mt.t2))); modo |= 8; }
            gl.uniform_1_i32(p.u(U::Modo), modo);
        }
        gl.draw_elements(glow::TRIANGLES, it.sn as i32, if m.i32 { glow::UNSIGNED_INT } else { glow::UNSIGNED_SHORT }, (it.s0 * if m.i32 { 4 } else { 2 }) as i32);
    }

    /// los uniformes de la pasada (cámara, sol, cielo, niebla, sombra y luces) en un programa
    unsafe fn luces(&self, p: &Prog, vp: &M4, clip: f32) {
        let gl = &self.gl; let c = self.c.as_ref().unwrap(); let l = &c.luz; let s = self.sol(); let cp = &c.pos;
        gl.use_program(Some(p.p));
        gl.uniform_matrix_4_f32_slice(p.u(U::VP), false, vp); gl.uniform_matrix_4_f32_slice(p.u(U::SVP), false, &self.svp);
        gl.uniform_3_f32(p.u(U::Sol), s[0], s[1], s[2]); gl.uniform_3_f32(p.u(U::SolC), l.sol_c[0], l.sol_c[1], l.sol_c[2]);
        gl.uniform_3_f32(p.u(U::AmbS), l.amb_s[0], l.amb_s[1], l.amb_s[2]); gl.uniform_3_f32(p.u(U::AmbG), l.amb_g[0], l.amb_g[1], l.amb_g[2]);
        gl.uniform_3_f32(p.u(U::NieC), l.nie.c[0], l.nie.c[1], l.nie.c[2]); gl.uniform_2_f32(p.u(U::Nie), l.nie.a, l.nie.b);
        gl.uniform_3_f32(p.u(U::Cam), cp[0], cp[1], cp[2]); gl.uniform_1_f32(p.u(U::Expo), l.expo);
        gl.uniform_1_f32(p.u(U::Sombra), if self.op.sombras && self.sombra.is_some() { 1.0 } else { 0.0 });
        gl.uniform_1_f32(p.u(U::Clip), clip);
        gl.uniform_2_f32(p.u(U::Sesgo), self.sesgo[0], self.sesgo[1]);
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
        gl.depth_mask(false); gl.bind_vertex_array(None); gl.draw_arrays(glow::TRIANGLES, 0, 3); gl.depth_mask(true);
    }

    /// lo opaco que se ve con otra matriz (el reflejo, la sombra), con y sin huesos
    fn recortar(&self, vp: &M4, sombra: bool) -> Vec<usize> {
        let pl = mat::planos(vp);
        let mut v: Vec<usize> = self.items.iter().enumerate().filter(|(_, it)| {
            let (Some(_), Some(mt)) = (self.mallas.get(&it.m), self.mats.get(&it.mat)) else { return false };
            mt.agua == 0 && mt.blend == 0 && mt.add == 0 && !(sombra && it.fl & FL_SIN_SOMBRA != 0) && mat::esfera_dentro(&pl, &it.esf)
        }).map(|(i, _)| i).collect();
        v.sort_by_key(|&i| { let it = &self.items[i]; (!it.h.is_empty() && self.mallas[&it.m].piel, self.mats[&it.mat].t, it.m) });
        v
    }
    /// dibuja una lista de lo opaco con el programa de luz (o el de sombra), cambiando al de huesos cuando toca
    unsafe fn dibujar_lista(&self, lista: &[usize], vp: &M4, clip: f32, de_sombra: bool) -> u32 {
        let mut piel_act: Option<bool> = None;
        for &i in lista {
            let it = &self.items[i]; let piel = !it.h.is_empty() && self.mallas.get(&it.m).map(|m| m.piel).unwrap_or(false);
            let p = match (de_sombra, piel) { (false, false) => &self.p_luz, (false, true) => &self.p_luz_piel, (true, false) => &self.p_sombra, (true, true) => &self.p_sombra_piel };
            if piel_act != Some(piel) {
                piel_act = Some(piel);
                if de_sombra { self.gl.use_program(Some(p.p)); self.gl.uniform_matrix_4_f32_slice(p.u(U::VP), false, vp); }
                else { self.luces(p, vp, clip); }
            }
            self.dibujar_item(p, it, !de_sombra);
        }
        lista.len() as u32
    }

    /// la sombra del sol: un mapa de profundidad ortográfico alrededor de la cámara, con lo opaco
    unsafe fn pasada_sombra(&mut self) {
        let px = self.op.sombra_px;
        if self.sombra.as_ref().map(|s| s.2 != px).unwrap_or(true) {
            if let Some((f, t, _)) = self.sombra.take() { self.gl.delete_framebuffer(f); self.gl.delete_texture(t); }
            let gl = &self.gl;
            let t = gl.create_texture().unwrap(); gl.bind_texture(glow::TEXTURE_2D, Some(t));
            gl.tex_storage_2d(glow::TEXTURE_2D, 1, glow::DEPTH_COMPONENT24, px, px);
            gl.tex_parameter_i32(glow::TEXTURE_2D, glow::TEXTURE_MIN_FILTER, glow::LINEAR as i32); gl.tex_parameter_i32(glow::TEXTURE_2D, glow::TEXTURE_MAG_FILTER, glow::LINEAR as i32);
            gl.tex_parameter_i32(glow::TEXTURE_2D, glow::TEXTURE_COMPARE_MODE, glow::COMPARE_REF_TO_TEXTURE as i32); gl.tex_parameter_i32(glow::TEXTURE_2D, glow::TEXTURE_COMPARE_FUNC, glow::LEQUAL as i32);
            gl.tex_parameter_i32(glow::TEXTURE_2D, glow::TEXTURE_WRAP_S, glow::CLAMP_TO_EDGE as i32); gl.tex_parameter_i32(glow::TEXTURE_2D, glow::TEXTURE_WRAP_T, glow::CLAMP_TO_EDGE as i32);
            let f = gl.create_framebuffer().unwrap(); gl.bind_framebuffer(glow::FRAMEBUFFER, Some(f));
            gl.framebuffer_texture_2d(glow::FRAMEBUFFER, glow::DEPTH_ATTACHMENT, glow::TEXTURE_2D, Some(t), 0);
            gl.draw_buffers(&[glow::NONE]);
            self.sombra = Some((f, t, px));
        }
        let c = self.c.as_ref().unwrap().pos; let s = self.sol(); let r = self.op.sombra_radio;
        // (el centro, en pasos de un píxel de la sombra: la sombra no tiembla al moverse la cámara)
        let paso = 2.0 * r / px as f32; let cen = [(c[0] / paso).round() * paso, (c[1] / paso).round() * paso, (c[2] / paso).round() * paso];
        // (lo que hay entre el sol y la caja, hasta 80 m más arriba, también tapa; el margen de profundidad, en metros)
        let alto = r + 80.0; let rango = alto + r;
        let ojo = [cen[0] + s[0] * alto, cen[1] + s[1] * alto, cen[2] + s[2] * alto];
        let arriba = if s[1].abs() > 0.95 { [0.0, 0.0, 1.0] } else { [0.0, 1.0, 0.0] };
        self.svp = mat::mul(&mat::orto(-r, r, -r, r, 0.5, rango), &mat::mirar(ojo, cen, arriba));
        self.sesgo = [0.04 / rango, 1.5 * paso];
        let lista = self.recortar(&self.svp.clone(), true);
        if std::env::var("JXM_DBG").is_ok() && self.cuadro == 0 {
            let piel: Vec<_> = self.items.iter().filter(|it| !it.h.is_empty()).map(|it| (it.m, it.esf, it.fl, it.h.len())).collect();
            let en: usize = lista.iter().filter(|&&i| !self.items[i].h.is_empty()).count();
            eprintln!("sombra: {} cosas, {} con huesos de {} · {:?}", lista.len(), en, piel.len(), &piel[..piel.len().min(6)]);
        }
        let gl = &self.gl;
        let (f, _, _) = self.sombra.as_ref().unwrap();
        gl.bind_framebuffer(glow::FRAMEBUFFER, Some(*f)); gl.viewport(0, 0, px, px);
        gl.clear(glow::DEPTH_BUFFER_BIT); gl.enable(glow::POLYGON_OFFSET_FILL); gl.polygon_offset(1.5, 3.0);
        let svp = self.svp;
        self.dibujos += self.dibujar_lista(&lista, &svp, -1e9, true);
        self.gl.disable(glow::POLYGON_OFFSET_FILL);
    }

    /// el reflejo del agua: la escena espejada en el plano del agua, a una fracción de la resolución
    unsafe fn pasada_reflejo(&mut self, w: i32, h: i32, ay: f32) {
        let (rw, rh) = ((w / self.op.reflejo_div).max(16), (h / self.op.reflejo_div).max(16));
        if self.reflejo.as_ref().map(|d| d.w != rw || d.h != rh).unwrap_or(true) { if let Some(d) = self.reflejo.take() { borrar_destino(&self.gl, d); } self.reflejo = Some(destino(&self.gl, rw, rh)); }
        let vp = mat::mul(&self.c.as_ref().unwrap().vp, &mat::espejo_y(ay));
        let lista = self.recortar(&vp, false);
        { let gl = &self.gl; let d = self.reflejo.as_ref().unwrap(); gl.bind_framebuffer(glow::FRAMEBUFFER, Some(d.fb)); gl.viewport(0, 0, d.w, d.h); gl.clear(glow::COLOR_BUFFER_BIT | glow::DEPTH_BUFFER_BIT); }
        self.cielo(&vp);
        self.dibujos += self.dibujar_lista(&lista, &vp, ay - 0.05, false);
    }

    /// un cuadro entero, en el destino `salida` (None = el de la superficie) de w × h
    pub unsafe fn dibujar(&mut self, salida: Option<glow::Framebuffer>, w: i32, h: i32) {
        self.dibujos = 0;
        if self.c.is_none() { let gl = &self.gl; gl.bind_framebuffer(glow::FRAMEBUFFER, salida); gl.viewport(0, 0, w, h); gl.clear_color(0.0, 0.0, 0.0, 1.0); gl.clear(glow::COLOR_BUFFER_BIT); return; }
        { let gl = &self.gl; gl.enable(glow::DEPTH_TEST); gl.depth_func(glow::LEQUAL); gl.disable(glow::BLEND); gl.disable(glow::CULL_FACE); }
        if self.op.sombras && (self.sombra.is_none() || self.cuadro % self.op.sombra_cada.max(1) as u64 == 0) { self.pasada_sombra(); }
        let ay = self.c.as_ref().unwrap().agua_y.or(self.agua.as_ref().map(|a| a.y));
        let hay_agua = !self.aguas.is_empty() && self.agua.is_some() && self.agua_n.is_some() && std::env::var("JXM_SIN_AGUA").is_err();
        let cam_arriba = ay.map(|y| self.c.as_ref().unwrap().pos[1] > y + 0.05).unwrap_or(false);
        if hay_agua && self.op.reflejo && cam_arriba && (self.reflejo.is_none() || self.cuadro % self.op.reflejo_cada.max(1) as u64 == 0) { self.pasada_reflejo(w, h, ay.unwrap()); }
        // la escena, a la resolución elegida
        let (ew, eh) = (((w as f32) * self.op.escala).round().max(16.0) as i32, ((h as f32) * self.op.escala).round().max(16.0) as i32);
        if self.escena_rt.as_ref().map(|d| d.w != ew || d.h != eh).unwrap_or(true) { if let Some(d) = self.escena_rt.take() { borrar_destino(&self.gl, d); } self.escena_rt = Some(destino(&self.gl, ew, eh)); }
        let fb = self.escena_rt.as_ref().unwrap().fb;
        { let gl = &self.gl; gl.bind_framebuffer(glow::FRAMEBUFFER, Some(fb)); gl.viewport(0, 0, ew, eh); gl.clear(glow::COLOR_BUFFER_BIT | glow::DEPTH_BUFFER_BIT); }
        let vp = self.c.as_ref().unwrap().vp;
        self.cielo(&vp);
        self.dibujos += self.dibujar_lista(&self.opacos, &vp, -1e9, false);
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
            for &i in &self.aguas {
                let it = &self.items[i]; let m = &self.mallas[&it.m];
                gl.bind_vertex_array(Some(m.vao)); gl.uniform_matrix_4_f32_slice(p.u(U::M), false, &it.mm);
                gl.uniform_3_f32(p.u(U::Mn), m.mn[0], m.mn[1], m.mn[2]); gl.uniform_3_f32(p.u(U::Sc), m.sc[0], m.sc[1], m.sc[2]); gl.uniform_4_f32(p.u(U::St), 1.0, 1.0, 0.0, 0.0);
                gl.draw_elements(glow::TRIANGLES, it.sn as i32, if m.i32 { glow::UNSIGNED_INT } else { glow::UNSIGNED_SHORT }, (it.s0 * if m.i32 { 4 } else { 2 }) as i32);
                self.dibujos += 1;
            }
        }
        let gl = &self.gl;
        gl.depth_mask(true); gl.disable(glow::BLEND);
        // a la pantalla, estirada (la escena a menos píxeles)
        gl.bind_framebuffer(glow::READ_FRAMEBUFFER, Some(fb)); gl.bind_framebuffer(glow::DRAW_FRAMEBUFFER, salida);
        gl.blit_framebuffer(0, 0, ew, eh, 0, 0, w, h, glow::COLOR_BUFFER_BIT, glow::LINEAR);
        gl.bind_framebuffer(glow::FRAMEBUFFER, salida);
        self.cuadro += 1;
    }

    pub fn resumen(&self) -> String {
        let n = self.items.len();
        format!("mapa {} · {} mallas · {} texturas · {} luces horneadas · {} materiales · {:.1} MB en la placa · {} cosas en el cuadro ({} opacas, {} transparentes, {} de agua a la vista)",
            self.mapa, self.mallas.len(), self.texs.len(), self.lms.len(), self.mats.len(), self.memoria as f64 / 1e6, n, self.opacos.len(), self.transp.len(), self.aguas.len())
    }
}

unsafe fn borrar_malla(gl: &glow::Context, m: MallaGL) { gl.delete_vertex_array(m.vao); for b in m.bufs { gl.delete_buffer(b); } }

