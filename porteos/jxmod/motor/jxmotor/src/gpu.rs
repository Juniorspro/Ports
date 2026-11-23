//! El dibujo nativo (GLES 3.0): la escena del juego con
//!  - la luz del juego: sol con sombra (mapa de profundidad del sol, 3×3 muestras), cielo y suelo, luz horneada de los mapas
//!    de Source, niebla y el tono de pantalla (ACES), como el sombreador de WebGL;
//!  - el agua de Half-Life 2: su mapa de normales en dos capas, Fresnel, el reflejo de la escena y lo turbio por lo hondo;
//!  - resolución dinámica: la escena a una fracción del tamaño de la pantalla y estirada al final (lo que más pesa en una
//!    placa floja son los píxeles), y la sombra y el reflejo rehechos cada tantos cuadros.
use crate::escena::{Escena, Item};
use crate::mat::{self, M4};
use glow::HasContext;

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

struct MallaGL { vao: glow::VertexArray, i32: bool, mn: [f32; 3], sc: [f32; 3], lm: i32 }
struct Destino { fb: glow::Framebuffer, color: glow::Texture, prof: Option<glow::Renderbuffer>, w: i32, h: i32 }
struct Prog { p: glow::Program, u: std::collections::HashMap<&'static str, glow::UniformLocation> }
impl Prog {
    fn u(&self, n: &str) -> Option<&glow::UniformLocation> { self.u.get(n) }
}

pub struct Motor {
    pub gl: glow::Context,
    pub op: Opciones,
    esc: Escena,
    mallas: Vec<MallaGL>,
    texs: Vec<glow::Texture>,
    lms: Vec<glow::Texture>,
    blanca: glow::Texture,
    agua_n: Option<glow::Texture>,
    agua_p: Option<glow::Texture>,
    p_luz: Prog, p_sombra: Prog, p_agua: Prog, p_cielo: Prog,
    sombra: Option<(glow::Framebuffer, glow::Texture, i32)>,
    reflejo: Option<Destino>,
    escena_rt: Option<Destino>,
    svp: M4,
    pub cuadro: u64,
    pub dibujos: u32,
    opacos: Vec<usize>, transp: Vec<usize>, aguas: Vec<usize>,
}

const VS_LUZ: &str = r#"#version 300 es
layout(location = 0) in vec3 aP; layout(location = 1) in vec4 aN; layout(location = 2) in vec2 aU; layout(location = 5) in vec2 aL;
uniform mat4 uVP, uM, uSVP; uniform vec3 uMn, uSc; uniform vec4 uSt;
out vec3 vW; out vec3 vN; out vec2 vU; out vec2 vL; out vec4 vS; out float vMz;
void main() {
  vec4 w = uM * vec4(uMn + aP * uSc, 1.0);
  vMz = aN.w; vW = w.xyz; vN = mat3(uM) * aN.xyz; vU = aU * uSt.xy + uSt.zw; vL = aL; vS = uSVP * w;
  gl_Position = uVP * w;
}"#;
const FS_LUZ: &str = r#"#version 300 es
precision highp float; precision highp sampler2DShadow;
uniform sampler2D uT, uLM, uT1, uT2, uT3; uniform vec4 uS1; uniform vec2 uS3; uniform sampler2DShadow uSM;
uniform vec4 uC; uniform vec3 uSol, uSolC, uAmbS, uAmbG, uNieC, uCam, uEm; uniform vec2 uNie; uniform float uExpo, uSombra, uClip; uniform int uModo;
in vec3 vW; in vec3 vN; in vec2 vU; in vec2 vL; in vec4 vS; in float vMz; out vec4 o;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
float sombra(float nd) {
  if (uSombra < 0.5) return 1.0;
  vec3 q = vS.xyz / vS.w * 0.5 + 0.5;
  if (q.x <= 0.0 || q.y <= 0.0 || q.x >= 1.0 || q.y >= 1.0 || q.z >= 1.0) return 1.0;
  vec2 t = 1.0 / vec2(textureSize(uSM, 0)); float b = 0.0012 + 0.002 * (1.0 - nd), s = 0.0;
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
  float nd = max(dot(n, uSol), 0.0);
  if ((uModo & 4) != 0) luz = vec3(1.4);
  else if ((uModo & 1) != 0) luz = pow(texture(uLM, vL).rgb, vec3(2.2)) * 4.0 * mix(0.6, 1.0, sombra(nd));
  else luz = mix(uAmbG, uAmbS, n.y * 0.5 + 0.5) + uSolC * nd * sombra(nd);
  vec3 col = alb * luz + uEm;
  float f = clamp((distance(vW, uCam) - uNie.x) / max(uNie.y - uNie.x, 0.001), 0.0, 1.0);
  col = mix(col, uNieC, f);
  o = vec4(pow(aces(col * uExpo), vec3(1.0 / 2.2)), t.a);
}"#;
const VS_SOMBRA: &str = r#"#version 300 es
layout(location = 0) in vec3 aP; uniform mat4 uVP, uM; uniform vec3 uMn, uSc;
void main() { gl_Position = uVP * uM * vec4(uMn + aP * uSc, 1.0); }"#;
const FS_SOMBRA: &str = r#"#version 300 es
precision mediump float; out vec4 o; void main() { o = vec4(1.0); }"#;
const FS_AGUA: &str = r#"#version 300 es
precision highp float;
uniform sampler2D uN, uRef, uP;
uniform vec4 uF, uH, uS, uB; uniform vec2 uD, uRefInv; uniform float uTiempo, uExpo;
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
  float rv = max(dot(reflect(-v, n), uSol), 0.0), sp = pow(rv, 900.0) * 3.0 * step(0.0, uSol.y);
  vec3 col = mix(cuerpo, refl, fr) + uSolC * sp;
  vec2 pb = (vW.xz - uB.xy) * uB.zw;
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

unsafe fn programa(gl: &glow::Context, vs: &str, fs: &str, nombres: &[&'static str]) -> Result<Prog, String> {
    let p = gl.create_program()?;
    let mut ss = vec![];
    for (t, src) in [(glow::VERTEX_SHADER, vs), (glow::FRAGMENT_SHADER, fs)] {
        let s = gl.create_shader(t)?; gl.shader_source(s, src); gl.compile_shader(s);
        if !gl.get_shader_compile_status(s) { return Err(format!("sombreador: {}", gl.get_shader_info_log(s))); }
        gl.attach_shader(p, s); ss.push(s);
    }
    gl.link_program(p);
    if !gl.get_program_link_status(p) { return Err(format!("programa: {}", gl.get_program_info_log(p))); }
    for s in ss { gl.detach_shader(p, s); gl.delete_shader(s); }
    let mut u = std::collections::HashMap::new();
    for n in nombres { if let Some(l) = gl.get_uniform_location(p, n) { u.insert(*n, l); } }
    gl.use_program(Some(p));
    for (n, unidad) in [("uT", 0), ("uLM", 1), ("uSM", 2), ("uN", 0), ("uRef", 3), ("uP", 4), ("uT1", 5), ("uT2", 6), ("uT3", 7)] { if let Some(l) = u.get(n) { gl.uniform_1_i32(Some(l), unidad); } }
    Ok(Prog { p, u })
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

const U_LUZ: &[&str] = &["uT1", "uT2", "uT3", "uS1", "uS3", "uVP", "uM", "uSVP", "uMn", "uSc", "uSt", "uT", "uLM", "uSM", "uC", "uSol", "uSolC", "uAmbS", "uAmbG", "uNieC", "uCam", "uEm", "uNie", "uExpo", "uSombra", "uClip", "uModo"];
const U_AGUA: &[&str] = &["uVP", "uM", "uSVP", "uMn", "uSc", "uSt", "uN", "uRef", "uP", "uF", "uH", "uS", "uB", "uD", "uRefInv", "uTiempo", "uExpo", "uSol", "uSolC", "uAmbS", "uAmbG", "uCam"];

impl Motor {
    /// sube a la placa todo lo de la escena (mallas, texturas, luces horneadas, el agua) y arma los sombreadores
    pub unsafe fn nuevo(gl: glow::Context, esc: Escena, op: Opciones) -> Result<Motor, String> {
        let p_luz = programa(&gl, VS_LUZ, FS_LUZ, U_LUZ)?;
        let p_sombra = programa(&gl, VS_SOMBRA, FS_SOMBRA, &["uVP", "uM", "uMn", "uSc"])?;
        let p_agua = programa(&gl, VS_LUZ, FS_AGUA, U_AGUA)?;
        let p_cielo = programa(&gl, VS_CIELO, FS_CIELO, &["uIVP", "uSol", "uNieC", "uExpo"])?;
        let mut mallas = vec![];
        for m in &esc.c.mallas {
            let vao = gl.create_vertex_array()?; gl.bind_vertex_array(Some(vao));
            let vb = gl.create_buffer()?; gl.bind_buffer(glow::ARRAY_BUFFER, Some(vb));
            gl.buffer_data_u8_slice(glow::ARRAY_BUFFER, esc.bloque(m.vo, m.v as usize * 14), glow::STATIC_DRAW);
            gl.enable_vertex_attrib_array(0); gl.vertex_attrib_pointer_f32(0, 3, glow::UNSIGNED_SHORT, true, 14, 0);
            gl.enable_vertex_attrib_array(1); gl.vertex_attrib_pointer_f32(1, 4, glow::BYTE, true, 14, 6);
            gl.enable_vertex_attrib_array(2); gl.vertex_attrib_pointer_f32(2, 2, glow::HALF_FLOAT, false, 14, 10);
            if m.lo >= 0 {
                let lb = gl.create_buffer()?; gl.bind_buffer(glow::ARRAY_BUFFER, Some(lb));
                gl.buffer_data_u8_slice(glow::ARRAY_BUFFER, esc.bloque(m.lo as usize, m.v as usize * 4), glow::STATIC_DRAW);
                gl.enable_vertex_attrib_array(5); gl.vertex_attrib_pointer_f32(5, 2, glow::UNSIGNED_SHORT, true, 4, 0);
            } else { gl.disable_vertex_attrib_array(5); gl.vertex_attrib_2_f32(5, 0.0, 0.0); }
            let ib = gl.create_buffer()?; gl.bind_buffer(glow::ELEMENT_ARRAY_BUFFER, Some(ib));
            gl.buffer_data_u8_slice(glow::ELEMENT_ARRAY_BUFFER, esc.bloque(m.io, m.ni as usize * if m.i32 != 0 { 4 } else { 2 }), glow::STATIC_DRAW);
            gl.bind_vertex_array(None);
            mallas.push(MallaGL { vao, i32: m.i32 != 0, mn: m.mn, sc: m.sc, lm: m.lm });
        }
        let texs = esc.c.texs.iter().map(|t| textura(&gl, t.w, t.h, esc.bloque(t.o, (t.w * t.h * 4) as usize), true, true)).collect();
        let lms = esc.c.lms.iter().map(|t| textura(&gl, t.w, t.h, esc.bloque(t.o, (t.w * t.h * 4) as usize), false, false)).collect();
        let blanca = textura(&gl, 1, 1, &[255, 255, 255, 255], true, false);
        let (mut agua_n, mut agua_p) = (None, None);
        if let Some(a) = &esc.c.agua {
            if let Some(n) = &a.normal { agua_n = Some(textura(&gl, n.w, n.h, esc.bloque(n.o, (n.w * n.h * 4) as usize), true, true)); }
            if let Some(p) = a.prof.as_ref().and_then(|p| p.tex.as_ref()) { agua_p = Some(textura(&gl, p.w, p.h, esc.bloque(p.o, (p.w * p.h * 4) as usize), false, false)); }
        }
        // (qué se dibuja en cada pasada: lo opaco ordenado por textura —menos cambios de estado—, lo transparente, el agua)
        let (mut opacos, mut transp, mut aguas) = (vec![], vec![], vec![]);
        for (i, it) in esc.c.items.iter().enumerate() {
            let m = &esc.c.mats[it.mat];
            if m.agua != 0 { aguas.push(i) } else if m.blend != 0 || m.add != 0 { transp.push(i) } else { opacos.push(i) }
        }
        opacos.sort_by_key(|&i| (esc.c.mats[esc.c.items[i].mat].t, esc.c.items[i].m));
        Ok(Motor { gl, op, esc, mallas, texs, lms, blanca, agua_n, agua_p, p_luz, p_sombra, p_agua, p_cielo, sombra: None, reflejo: None, escena_rt: None, svp: mat::id(), cuadro: 0, dibujos: 0, opacos, transp, aguas })
    }

    fn sol(&self) -> [f32; 3] { mat::norm(self.esc.c.luz.sol) }

    unsafe fn dibujar_item(&self, p: &Prog, it: &Item, conluz: bool) {
        let gl = &self.gl; let m = &self.mallas[it.m];
        gl.bind_vertex_array(Some(m.vao));
        gl.uniform_matrix_4_f32_slice(p.u("uM"), false, &it.mm);
        gl.uniform_3_f32(p.u("uMn"), m.mn[0], m.mn[1], m.mn[2]); gl.uniform_3_f32(p.u("uSc"), m.sc[0], m.sc[1], m.sc[2]);
        if conluz {
            let mt = &self.esc.c.mats[it.mat];
            gl.uniform_4_f32(p.u("uSt"), mt.st[0], mt.st[1], mt.st[2], mt.st[3]);
            gl.uniform_4_f32(p.u("uC"), mt.c[0], mt.c[1], mt.c[2], mt.c[3]);
            gl.uniform_3_f32(p.u("uEm"), mt.em[0], mt.em[1], mt.em[2]);
            gl.active_texture(glow::TEXTURE0); gl.bind_texture(glow::TEXTURE_2D, Some(if mt.t >= 0 { self.texs[mt.t as usize] } else { self.blanca }));
            let lm = m.lm >= 0 && (m.lm as usize) < self.lms.len();
            if lm { gl.active_texture(glow::TEXTURE1); gl.bind_texture(glow::TEXTURE_2D, Some(self.lms[m.lm as usize])); }
            let tx = |i: i32| if i >= 0 && (i as usize) < self.texs.len() { self.texs[i as usize] } else { self.blanca };
            let mut modo = (lm as i32) | if mt.cut != 0 { 2 } else { 0 } | if mt.unlit != 0 { 4 } else { 0 };
            if let Some(tr) = mt.terr.as_ref().filter(|t| t.len() == 3) {
                for (k, c) in tr.iter().enumerate() { gl.active_texture(glow::TEXTURE5 + k as u32); gl.bind_texture(glow::TEXTURE_2D, Some(tx(c.0))); }
                gl.uniform_4_f32(p.u("uS1"), tr[0].1, tr[0].2, tr[1].1, tr[1].2); gl.uniform_2_f32(p.u("uS3"), tr[2].1, tr[2].2); modo |= 16;
            } else if mt.t2 >= 0 { gl.active_texture(glow::TEXTURE5); gl.bind_texture(glow::TEXTURE_2D, Some(tx(mt.t2))); modo |= 8; }
            gl.uniform_1_i32(p.u("uModo"), modo);
        }
        gl.draw_elements(glow::TRIANGLES, it.sn as i32, if m.i32 { glow::UNSIGNED_INT } else { glow::UNSIGNED_SHORT }, (it.s0 * if m.i32 { 4 } else { 2 }) as i32);
    }

    unsafe fn luces(&self, p: &Prog, vp: &M4) {
        let gl = &self.gl; let l = &self.esc.c.luz; let s = self.sol(); let c = &self.esc.c.cam.pos;
        gl.use_program(Some(p.p));
        gl.uniform_matrix_4_f32_slice(p.u("uVP"), false, vp); gl.uniform_matrix_4_f32_slice(p.u("uSVP"), false, &self.svp);
        gl.uniform_3_f32(p.u("uSol"), s[0], s[1], s[2]); gl.uniform_3_f32(p.u("uSolC"), l.sol_c[0], l.sol_c[1], l.sol_c[2]);
        gl.uniform_3_f32(p.u("uAmbS"), l.amb_s[0], l.amb_s[1], l.amb_s[2]); gl.uniform_3_f32(p.u("uAmbG"), l.amb_g[0], l.amb_g[1], l.amb_g[2]);
        gl.uniform_3_f32(p.u("uNieC"), l.nie.c[0], l.nie.c[1], l.nie.c[2]); gl.uniform_2_f32(p.u("uNie"), l.nie.a, l.nie.b);
        gl.uniform_3_f32(p.u("uCam"), c[0], c[1], c[2]); gl.uniform_1_f32(p.u("uExpo"), l.expo);
        gl.uniform_1_f32(p.u("uSombra"), if self.op.sombras && self.sombra.is_some() { 1.0 } else { 0.0 });
        gl.uniform_1_f32(p.u("uClip"), -1e9);
        if let Some((_, t, _)) = &self.sombra { gl.active_texture(glow::TEXTURE2); gl.bind_texture(glow::TEXTURE_2D, Some(*t)); }
    }

    unsafe fn cielo(&self, vp: &M4) {
        let gl = &self.gl; let p = &self.p_cielo; let s = self.sol(); let l = &self.esc.c.luz;
        gl.use_program(Some(p.p)); gl.uniform_matrix_4_f32_slice(p.u("uIVP"), false, &mat::inv(vp));
        gl.uniform_3_f32(p.u("uSol"), s[0], s[1], s[2]); gl.uniform_3_f32(p.u("uNieC"), l.nie.c[0], l.nie.c[1], l.nie.c[2]); gl.uniform_1_f32(p.u("uExpo"), l.expo);
        gl.depth_mask(false); gl.bind_vertex_array(None); gl.draw_arrays(glow::TRIANGLES, 0, 3); gl.depth_mask(true);
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
        let gl = &self.gl;
        let c = self.esc.c.cam.pos; let s = self.sol(); let r = self.op.sombra_radio;
        // (el centro, en pasos de un píxel de la sombra: la sombra no tiembla al moverse la cámara)
        let paso = 2.0 * r / px as f32; let cen = [(c[0] / paso).round() * paso, (c[1] / paso).round() * paso, (c[2] / paso).round() * paso];
        let ojo = [cen[0] + s[0] * 150.0, cen[1] + s[1] * 150.0, cen[2] + s[2] * 150.0];
        let arriba = if s[1].abs() > 0.95 { [0.0, 0.0, 1.0] } else { [0.0, 1.0, 0.0] };
        let svp = mat::mul(&mat::orto(-r, r, -r, r, 1.0, 320.0), &mat::mirar(ojo, cen, arriba));
        self.svp = svp;
        let gl = &self.gl;
        let (f, _, _) = self.sombra.as_ref().unwrap();
        gl.bind_framebuffer(glow::FRAMEBUFFER, Some(*f)); gl.viewport(0, 0, px, px);
        gl.clear(glow::DEPTH_BUFFER_BIT); gl.enable(glow::POLYGON_OFFSET_FILL); gl.polygon_offset(1.5, 3.0);
        gl.disable(glow::CULL_FACE);
        gl.use_program(Some(self.p_sombra.p)); gl.uniform_matrix_4_f32_slice(self.p_sombra.u("uVP"), false, &self.svp);
        for &i in &self.opacos { let it = &self.esc.c.items[i]; self.dibujar_item(&self.p_sombra, it, false); self.dibujos += 1; }
        gl.disable(glow::POLYGON_OFFSET_FILL);
    }

    /// el reflejo del agua: la escena espejada en el plano del agua, a una fracción de la resolución
    unsafe fn pasada_reflejo(&mut self, w: i32, h: i32) {
        let Some(ay) = self.esc.c.agua.as_ref().map(|a| a.y) else { return };
        let (rw, rh) = ((w / self.op.reflejo_div).max(16), (h / self.op.reflejo_div).max(16));
        if self.reflejo.as_ref().map(|d| d.w != rw || d.h != rh).unwrap_or(true) { if let Some(d) = self.reflejo.take() { borrar_destino(&self.gl, d); } self.reflejo = Some(destino(&self.gl, rw, rh)); }
        let vp = mat::mul(&self.esc.c.cam.vp, &mat::espejo_y(ay));
        let gl = &self.gl; let d = self.reflejo.as_ref().unwrap();
        gl.bind_framebuffer(glow::FRAMEBUFFER, Some(d.fb)); gl.viewport(0, 0, d.w, d.h);
        gl.clear(glow::COLOR_BUFFER_BIT | glow::DEPTH_BUFFER_BIT);
        self.cielo(&vp);
        self.luces(&self.p_luz, &vp); gl.uniform_1_f32(self.p_luz.u("uClip"), ay - 0.05);
        for &i in &self.opacos { self.dibujar_item(&self.p_luz, &self.esc.c.items[i], true); self.dibujos += 1; }
    }

    /// un cuadro entero, en el destino `salida` (None = el de la superficie) de w × h
    pub unsafe fn cuadro(&mut self, salida: Option<glow::Framebuffer>, w: i32, h: i32) {
        self.dibujos = 0;
        let gl = &self.gl;
        gl.enable(glow::DEPTH_TEST); gl.depth_func(glow::LEQUAL); gl.disable(glow::BLEND); gl.disable(glow::CULL_FACE);
        if self.op.sombras && (self.sombra.is_none() || self.cuadro % self.op.sombra_cada.max(1) as u64 == 0) { self.pasada_sombra(); }
        let hay_agua = !self.aguas.is_empty() && self.esc.c.agua.is_some() && self.agua_n.is_some() && std::env::var("JXM_SIN_AGUA").is_err();
        let cam_arriba = self.esc.c.agua.as_ref().map(|a| self.esc.c.cam.pos[1] > a.y + 0.05).unwrap_or(false);
        if hay_agua && self.op.reflejo && cam_arriba && (self.reflejo.is_none() || self.cuadro % self.op.reflejo_cada.max(1) as u64 == 0) { self.pasada_reflejo(w, h); }
        // la escena, a la resolución elegida
        let (ew, eh) = (((w as f32) * self.op.escala).round().max(16.0) as i32, ((h as f32) * self.op.escala).round().max(16.0) as i32);
        if self.escena_rt.as_ref().map(|d| d.w != ew || d.h != eh).unwrap_or(true) { if let Some(d) = self.escena_rt.take() { borrar_destino(&self.gl, d); } self.escena_rt = Some(destino(&self.gl, ew, eh)); }
        let gl = &self.gl; let d = self.escena_rt.as_ref().unwrap();
        gl.bind_framebuffer(glow::FRAMEBUFFER, Some(d.fb)); gl.viewport(0, 0, ew, eh);
        gl.clear(glow::COLOR_BUFFER_BIT | glow::DEPTH_BUFFER_BIT);
        let vp = self.esc.c.cam.vp;
        self.cielo(&vp);
        self.luces(&self.p_luz, &vp);
        for &i in &self.opacos { self.dibujar_item(&self.p_luz, &self.esc.c.items[i], true); self.dibujos += 1; }
        // lo transparente y el agua, mezclados y sin escribir profundidad
        gl.enable(glow::BLEND); gl.blend_func(glow::SRC_ALPHA, glow::ONE_MINUS_SRC_ALPHA); gl.depth_mask(false);
        for &i in &self.transp { let it = &self.esc.c.items[i]; if self.esc.c.mats[it.mat].add != 0 { gl.blend_func(glow::SRC_ALPHA, glow::ONE); } self.dibujar_item(&self.p_luz, it, true); gl.blend_func(glow::SRC_ALPHA, glow::ONE_MINUS_SRC_ALPHA); self.dibujos += 1; }
        if hay_agua {
            let a = self.esc.c.agua.as_ref().unwrap(); let p = &self.p_agua;
            self.luces(p, &vp);
            gl.uniform_4_f32(p.u("uF"), a.fog[0], a.fog[1], a.fog[2], a.fog[3]);
            let refl_on = self.op.reflejo && cam_arriba && self.reflejo.is_some();
            gl.uniform_4_f32(p.u("uH"), a.esc, a.fuerza, a.dist, if refl_on { 1.0 } else { 0.0 });
            gl.uniform_4_f32(p.u("uS"), a.s[0], a.s[1], a.s[2], a.s[3]);
            let (bx, bz, bw, bh, bd) = a.prof.as_ref().map(|q| (q.x0, q.z0, 1.0 / q.w, 1.0 / q.h, q.d)).unwrap_or((0.0, 0.0, 0.0, 0.0, 20.0));
            gl.uniform_4_f32(p.u("uB"), bx, bz, bw, bh); gl.uniform_2_f32(p.u("uD"), bd, a.largo.max(0.5));
            gl.uniform_2_f32(p.u("uRefInv"), 1.0 / ew as f32, 1.0 / eh as f32); gl.uniform_1_f32(p.u("uTiempo"), self.cuadro as f32 / 60.0);
            gl.active_texture(glow::TEXTURE0); gl.bind_texture(glow::TEXTURE_2D, self.agua_n);
            if let Some(r) = &self.reflejo { gl.active_texture(glow::TEXTURE3); gl.bind_texture(glow::TEXTURE_2D, Some(r.color)); }
            gl.active_texture(glow::TEXTURE4); gl.bind_texture(glow::TEXTURE_2D, Some(self.agua_p.unwrap_or(self.blanca)));
            for &i in &self.aguas {
                let it = &self.esc.c.items[i]; let m = &self.mallas[it.m];
                gl.bind_vertex_array(Some(m.vao)); gl.uniform_matrix_4_f32_slice(p.u("uM"), false, &it.mm);
                gl.uniform_3_f32(p.u("uMn"), m.mn[0], m.mn[1], m.mn[2]); gl.uniform_3_f32(p.u("uSc"), m.sc[0], m.sc[1], m.sc[2]); gl.uniform_4_f32(p.u("uSt"), 1.0, 1.0, 0.0, 0.0);
                gl.draw_elements(glow::TRIANGLES, it.sn as i32, if m.i32 { glow::UNSIGNED_INT } else { glow::UNSIGNED_SHORT }, (it.s0 * if m.i32 { 4 } else { 2 }) as i32);
                self.dibujos += 1;
            }
        }
        gl.depth_mask(true); gl.disable(glow::BLEND);
        // a la pantalla, estirada (la escena a menos píxeles)
        gl.bind_framebuffer(glow::READ_FRAMEBUFFER, Some(d.fb)); gl.bind_framebuffer(glow::DRAW_FRAMEBUFFER, salida);
        gl.blit_framebuffer(0, 0, ew, eh, 0, 0, w, h, glow::COLOR_BUFFER_BIT, glow::LINEAR);
        gl.bind_framebuffer(glow::FRAMEBUFFER, salida);
        self.cuadro += 1;
    }

    pub fn resumen(&self) -> String {
        format!("mapa {} · {} mallas · {} texturas · {} dibujos ({} opacos, {} transparentes, {} de agua)", self.esc.c.mapa, self.mallas.len(), self.texs.len(), self.esc.c.items.len(), self.opacos.len(), self.transp.len(), self.aguas.len())
    }
    pub fn tam_original(&self) -> (u32, u32) { (self.esc.c.w, self.esc.c.h) }
}
