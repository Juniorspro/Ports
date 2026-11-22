//! El dibujo con la placa de video (OpenGL ES 2.0, sin dependencias): la imagen que miró el motor de fondo y encima
//! la mano en 3D (`malla.rs`) que recubre cada mano, en el mismo cuadro. Corre en el hilo del motor, con el contexto de
//! OpenGL que arma la app (EGL); en la PC se prueba con Mesa (`banco escena`).
//!
//! Estilos: 0 cristal (translúcido, con el degradé de JXApps y el borde que brilla) · 1 piel (opaca, del color de tu
//! propia mano, medido en el cuadro) · 2 robot (metal) · 3 esqueleto (huesos y articulaciones en 3D).
use crate::malla::{Malla, POR_VERTICE};
use crate::mano::PUNTOS;
use std::ffi::{c_char, c_void, CString};

#[allow(non_camel_case_types)]
type GLenum = u32;
#[allow(non_camel_case_types)]
type GLuint = u32;
#[allow(non_camel_case_types)]
type GLint = i32;

const GL_TRIANGLES: GLenum = 0x0004;
const GL_DEPTH_BUFFER_BIT: GLenum = 0x0100;
const GL_COLOR_BUFFER_BIT: GLenum = 0x4000;
const GL_LESS: GLenum = 0x0201;
const GL_LEQUAL: GLenum = 0x0203;
const GL_SRC_ALPHA: GLenum = 0x0302;
const GL_ONE_MINUS_SRC_ALPHA: GLenum = 0x0303;
const GL_DEPTH_TEST: GLenum = 0x0B71;
const GL_BLEND: GLenum = 0x0BE2;
const GL_CULL_FACE: GLenum = 0x0B44;
const GL_UNPACK_ALIGNMENT: GLenum = 0x0CF5;
const GL_TEXTURE_2D: GLenum = 0x0DE1;
const GL_UNSIGNED_BYTE: GLenum = 0x1401;
const GL_UNSIGNED_SHORT: GLenum = 0x1403;
const GL_FLOAT: GLenum = 0x1406;
const GL_RGBA: GLenum = 0x1908;
const GL_LINEAR: GLint = 0x2601;
const GL_TEXTURE_MAG_FILTER: GLenum = 0x2800;
const GL_TEXTURE_MIN_FILTER: GLenum = 0x2801;
const GL_TEXTURE_WRAP_S: GLenum = 0x2802;
const GL_TEXTURE_WRAP_T: GLenum = 0x2803;
const GL_CLAMP_TO_EDGE: GLint = 0x812F;
const GL_TEXTURE0: GLenum = 0x84C0;
const GL_ARRAY_BUFFER: GLenum = 0x8892;
const GL_ELEMENT_ARRAY_BUFFER: GLenum = 0x8893;
const GL_STREAM_DRAW: GLenum = 0x88E0;
const GL_STATIC_DRAW: GLenum = 0x88E4;
const GL_FRAGMENT_SHADER: GLenum = 0x8B30;
const GL_VERTEX_SHADER: GLenum = 0x8B31;
const GL_COMPILE_STATUS: GLenum = 0x8B81;
const GL_LINK_STATUS: GLenum = 0x8B82;

#[link(name = "GLESv2")]
extern "C" {
    fn glActiveTexture(t: GLenum);
    fn glAttachShader(p: GLuint, s: GLuint);
    fn glBindAttribLocation(p: GLuint, i: GLuint, n: *const c_char);
    fn glBindBuffer(t: GLenum, b: GLuint);
    fn glBindTexture(t: GLenum, x: GLuint);
    fn glBlendFunc(a: GLenum, b: GLenum);
    fn glBufferData(t: GLenum, n: isize, d: *const c_void, u: GLenum);
    fn glClear(m: GLenum);
    fn glClearColor(r: f32, g: f32, b: f32, a: f32);
    fn glColorMask(r: u8, g: u8, b: u8, a: u8);
    fn glCompileShader(s: GLuint);
    fn glCreateProgram() -> GLuint;
    fn glCreateShader(t: GLenum) -> GLuint;
    fn glDeleteBuffers(n: i32, b: *const GLuint);
    fn glDeleteProgram(p: GLuint);
    fn glDeleteTextures(n: i32, t: *const GLuint);
    fn glDepthFunc(f: GLenum);
    fn glDepthMask(m: u8);
    fn glDisable(c: GLenum);
    fn glDisableVertexAttribArray(i: GLuint);
    fn glDrawArrays(m: GLenum, f: GLint, n: i32);
    fn glDrawElements(m: GLenum, n: i32, t: GLenum, i: *const c_void);
    fn glEnable(c: GLenum);
    fn glEnableVertexAttribArray(i: GLuint);
    fn glGenBuffers(n: i32, b: *mut GLuint);
    fn glGenTextures(n: i32, t: *mut GLuint);
    fn glGetProgramInfoLog(p: GLuint, n: i32, l: *mut i32, s: *mut c_char);
    fn glGetProgramiv(p: GLuint, q: GLenum, v: *mut GLint);
    fn glGetShaderInfoLog(s: GLuint, n: i32, l: *mut i32, x: *mut c_char);
    fn glGetShaderiv(s: GLuint, q: GLenum, v: *mut GLint);
    fn glGetUniformLocation(p: GLuint, n: *const c_char) -> GLint;
    fn glLinkProgram(p: GLuint);
    fn glPixelStorei(q: GLenum, v: GLint);
    fn glShaderSource(s: GLuint, n: i32, t: *const *const c_char, l: *const GLint);
    fn glTexImage2D(t: GLenum, l: GLint, f: GLint, w: i32, h: i32, b: GLint, ff: GLenum, ty: GLenum, d: *const c_void);
    fn glTexParameteri(t: GLenum, p: GLenum, v: GLint);
    fn glTexSubImage2D(t: GLenum, l: GLint, x: GLint, y: GLint, w: i32, h: i32, f: GLenum, ty: GLenum, d: *const c_void);
    fn glUniform1f(l: GLint, a: f32);
    fn glUniform1i(l: GLint, a: GLint);
    fn glUniform3f(l: GLint, a: f32, b: f32, c: f32);
    fn glUniform4f(l: GLint, a: f32, b: f32, c: f32, d: f32);
    fn glUseProgram(p: GLuint);
    fn glVertexAttribPointer(i: GLuint, n: GLint, t: GLenum, norm: u8, paso: i32, d: *const c_void);
    fn glViewport(x: GLint, y: GLint, w: i32, h: i32);
}

const VS_FONDO: &str = "attribute vec2 aPos; attribute vec2 aUV; varying vec2 vUV;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); vUV = aUV; }";
const FS_FONDO: &str = "precision mediump float; uniform sampler2D uTex; varying vec2 vUV;
void main() { gl_FragColor = vec4(texture2D(uTex, vUV).rgb, 1.0); }";

const VS_MANO: &str = "attribute vec3 aPos; attribute vec3 aNor; attribute vec2 aExtra;
uniform vec4 uXf; uniform float uZ;
varying vec3 vNor; varying vec2 vExtra; varying vec3 vPos;
void main() {
  gl_Position = vec4(aPos.x * uXf.x + uXf.z, aPos.y * uXf.y + uXf.w, aPos.z * uZ, 1.0);
  vNor = aNor; vExtra = aExtra; vPos = aPos;
}";
// la luz viene de arriba a la izquierda y de frente (y hacia abajo en la imagen; la cámara mira hacia z positiva)
const FS_MANO: &str = "precision mediump float;
varying vec3 vNor; varying vec2 vExtra; varying vec3 vPos;
uniform int uEstilo; uniform vec3 uPiel; uniform float uTiempo;
void main() {
  vec3 N = normalize(vNor);
  vec3 V = vec3(0.0, 0.0, -1.0);
  vec3 L = normalize(vec3(-0.35, -0.55, -0.75));
  float nv = max(dot(N, V), 0.0);
  float dif = max(dot(N, L), 0.0);
  vec3 H = normalize(L + V);
  float fres = pow(1.0 - nv, 2.2);
  float parte = vExtra.y;
  float alfa = vExtra.x;
  vec3 c; float a;
  if (uEstilo == 0) {
    // cristal: del violeta al rosa según el dedo, el borde brilla
    vec3 base = mix(vec3(0.48, 0.24, 1.0), vec3(1.0, 0.24, 0.54), clamp(parte / 5.0, 0.0, 1.0));
    if (parte > 4.5) base = vec3(0.62, 0.36, 1.0);
    float sp = pow(max(dot(N, H), 0.0), 48.0);
    c = base * (0.35 + 0.55 * dif) + vec3(1.0, 0.85, 1.0) * fres * 0.9 + vec3(1.0) * sp * 0.8;
    a = (0.30 + 0.62 * fres + sp * 0.5) * alfa;
  } else if (uEstilo == 1) {
    // piel: luz envolvente (la piel deja pasar un poco de luz) y un brillo suave
    float env = max((dot(N, L) + 0.45) / 1.45, 0.0);
    float sp = pow(max(dot(N, H), 0.0), 24.0);
    vec3 sub = uPiel * vec3(1.0, 0.55, 0.45);
    c = uPiel * (0.38 + 0.72 * env) + sub * 0.12 * (1.0 - env) + vec3(1.0, 0.95, 0.9) * sp * 0.18 + vec3(1.0, 0.8, 0.75) * fres * 0.12;
    a = alfa;
  } else if (uEstilo == 2) {
    // robot: metal con un reflejo del ambiente (claro arriba, oscuro abajo) y el borde violeta
    vec3 R = reflect(-V, N);
    float cielo = clamp(-R.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 env = mix(vec3(0.08, 0.08, 0.11), vec3(0.85, 0.88, 0.95), cielo * cielo);
    float sp = pow(max(dot(N, H), 0.0), 90.0);
    vec3 base = parte > 4.5 ? vec3(0.42, 0.44, 0.5) : vec3(0.62, 0.64, 0.7);
    c = base * (0.25 + 0.45 * dif) + env * 0.45 + vec3(1.0) * sp * 1.2 + vec3(0.55, 0.3, 1.0) * fres * 0.6;
    a = alfa;
  } else {
    // esqueleto: cada dedo de su color
    vec3 base = vec3(1.0);
    if (parte < 0.5) base = vec3(1.0, 0.30, 0.55); else if (parte < 1.5) base = vec3(1.0, 0.69, 0.13);
    else if (parte < 2.5) base = vec3(0.24, 0.86, 0.59); else if (parte < 3.5) base = vec3(0.22, 0.63, 1.0);
    else if (parte < 4.5) base = vec3(0.63, 0.4, 1.0);
    float sp = pow(max(dot(N, H), 0.0), 32.0);
    c = base * (0.45 + 0.6 * dif) + vec3(1.0) * sp * 0.5;
    a = alfa;
  }
  gl_FragColor = vec4(c, a);
}";

unsafe fn compilar(tipo: GLenum, src: &str) -> Result<GLuint, String> {
    let s = glCreateShader(tipo);
    let c = CString::new(src).unwrap();
    let p = c.as_ptr();
    glShaderSource(s, 1, &p, std::ptr::null());
    glCompileShader(s);
    let mut ok = 0; glGetShaderiv(s, GL_COMPILE_STATUS, &mut ok);
    if ok == 0 {
        let mut buf = vec![0u8; 2048]; let mut n = 0;
        glGetShaderInfoLog(s, 2048, &mut n, buf.as_mut_ptr() as *mut c_char);
        return Err(format!("shader: {}", String::from_utf8_lossy(&buf[..n.max(0) as usize])));
    }
    Ok(s)
}

unsafe fn programa(vs: &str, fs: &str, atributos: &[&str]) -> Result<GLuint, String> {
    let p = glCreateProgram();
    glAttachShader(p, compilar(GL_VERTEX_SHADER, vs)?);
    glAttachShader(p, compilar(GL_FRAGMENT_SHADER, fs)?);
    for (i, a) in atributos.iter().enumerate() { let c = CString::new(*a).unwrap(); glBindAttribLocation(p, i as GLuint, c.as_ptr()); }
    glLinkProgram(p);
    let mut ok = 0; glGetProgramiv(p, GL_LINK_STATUS, &mut ok);
    if ok == 0 {
        let mut buf = vec![0u8; 2048]; let mut n = 0;
        glGetProgramInfoLog(p, 2048, &mut n, buf.as_mut_ptr() as *mut c_char);
        return Err(format!("programa: {}", String::from_utf8_lossy(&buf[..n.max(0) as usize])));
    }
    Ok(p)
}

fn uniforme(p: GLuint, n: &str) -> GLint { let c = CString::new(n).unwrap(); unsafe { glGetUniformLocation(p, c.as_ptr()) } }

/// una mano para dibujar: los 21 puntos en píxeles de la imagen (z en las mismas unidades)
#[derive(Clone, Copy)]
pub struct ManoDibujo { pub pts: [[f32; 3]; PUNTOS] }

pub struct Escena {
    fondo: GLuint, mano: GLuint, tex: GLuint, tex_tam: (usize, usize), vb_fondo: GLuint, vb: GLuint, ib: GLuint,
    u_tex: GLint, u_xf: GLint, u_z: GLint, u_estilo: GLint, u_piel: GLint, u_tiempo: GLint,
    pub malla: Malla,
    piel: [f32; 3],
}

impl Escena {
    /// arma los programas y los búferes (con el contexto de OpenGL ya activo en este hilo)
    pub fn nueva() -> Result<Escena, String> {
        unsafe {
            let fondo = programa(VS_FONDO, FS_FONDO, &["aPos", "aUV"])?;
            let mano = programa(VS_MANO, FS_MANO, &["aPos", "aNor", "aExtra"])?;
            let mut b = [0u32; 3]; glGenBuffers(3, b.as_mut_ptr());
            let mut t = 0; glGenTextures(1, &mut t);
            Ok(Escena { fondo, mano, tex: t, tex_tam: (0, 0), vb_fondo: b[0], vb: b[1], ib: b[2],
                u_tex: uniforme(fondo, "uTex"), u_xf: uniforme(mano, "uXf"), u_z: uniforme(mano, "uZ"), u_estilo: uniforme(mano, "uEstilo"),
                u_piel: uniforme(mano, "uPiel"), u_tiempo: uniforme(mano, "uTiempo"), malla: Malla::default(), piel: [0.85, 0.62, 0.5] })
        }
    }

    /// borra lo de OpenGL (sólo si el contexto sigue vivo)
    pub fn soltar(&mut self) {
        unsafe {
            glDeleteProgram(self.fondo); glDeleteProgram(self.mano);
            let b = [self.vb_fondo, self.vb, self.ib]; glDeleteBuffers(3, b.as_ptr());
            glDeleteTextures(1, &self.tex);
        }
    }

    /// el color de la piel: el promedio de unos puntos de la palma en la imagen (se suaviza de un cuadro al otro)
    fn medir_piel(&mut self, rgba: &[u8], bw: usize, bh: usize, m: &ManoDibujo) {
        let p = &m.pts;
        let (mut s, mut n) = ([0f32; 3], 0f32);
        for &(a, b, c) in &[(0usize, 5usize, 17usize), (0, 9, 13), (0, 5, 9), (0, 13, 17)] {
            let (cx, cy) = ((p[a][0] + p[b][0] + p[c][0]) / 3.0, (p[a][1] + p[b][1] + p[c][1]) / 3.0);
            // el centro del triángulo y tres puntos entre el centro y cada vértice
            for &(vx, vy, t) in &[(cx, cy, 0.0f32), (p[a][0], p[a][1], 0.3), (p[b][0], p[b][1], 0.3), (p[c][0], p[c][1], 0.3)] {
                let (x, y) = (cx + (vx - cx) * t, cy + (vy - cy) * t);
                let (xi, yi) = (x.round() as isize, y.round() as isize);
                if xi < 0 || yi < 0 || xi as usize >= bw || yi as usize >= bh { continue; }
                let o = (yi as usize * bw + xi as usize) * 4;
                for q in 0..3 { s[q] += rgba[o + q] as f32 / 255.0; }
                n += 1.0;
            }
        }
        if n > 0.0 {
            for q in 0..3 { let v = (s[q] / n * 1.08).min(1.0); self.piel[q] += (v - self.piel[q]) * 0.2; }
        }
    }

    /// dibuja: la imagen (bw × bh RGBA) llenando la pantalla (vw × vh, recortando lo que sobra) y las manos encima
    pub fn dibujar(&mut self, rgba: &[u8], bw: usize, bh: usize, manos: &[ManoDibujo], estilo: i32, grosor: f32, vw: usize, vh: usize, tiempo: f32) {
        unsafe {
            glViewport(0, 0, vw as i32, vh as i32);
            glClearColor(0.0, 0.0, 0.0, 1.0);
            glDepthMask(1); glColorMask(1, 1, 1, 1);
            glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
            glDisable(GL_CULL_FACE);
            // ---- el fondo ----
            glActiveTexture(GL_TEXTURE0);
            glBindTexture(GL_TEXTURE_2D, self.tex);
            glPixelStorei(GL_UNPACK_ALIGNMENT, 1);
            if self.tex_tam != (bw, bh) {
                glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA as GLint, bw as i32, bh as i32, 0, GL_RGBA, GL_UNSIGNED_BYTE, rgba.as_ptr() as *const c_void);
                glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR); glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
                glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE); glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
                self.tex_tam = (bw, bh);
            } else {
                glTexSubImage2D(GL_TEXTURE_2D, 0, 0, 0, bw as i32, bh as i32, GL_RGBA, GL_UNSIGNED_BYTE, rgba.as_ptr() as *const c_void);
            }
            // la imagen llena la pantalla sin deformarse: el rectángulo de la imagen en píxeles de pantalla
            let esc = (vw as f32 / bw as f32).max(vh as f32 / bh as f32);
            let (ox, oy) = ((vw as f32 - bw as f32 * esc) / 2.0, (vh as f32 - bh as f32 * esc) / 2.0);
            let nx = |x: f32| x / vw as f32 * 2.0 - 1.0; let ny = |y: f32| 1.0 - y / vh as f32 * 2.0;
            let (x0, y0, x1, y1) = (nx(ox), ny(oy), nx(ox + bw as f32 * esc), ny(oy + bh as f32 * esc));
            let q: [f32; 16] = [x0, y0, 0.0, 0.0, x1, y0, 1.0, 0.0, x0, y1, 0.0, 1.0, x1, y1, 1.0, 1.0];
            glDisable(GL_DEPTH_TEST); glDisable(GL_BLEND);
            glUseProgram(self.fondo);
            glUniform1i(self.u_tex, 0);
            glBindBuffer(GL_ARRAY_BUFFER, self.vb_fondo);
            glBufferData(GL_ARRAY_BUFFER, 64, q.as_ptr() as *const c_void, GL_STATIC_DRAW);
            glEnableVertexAttribArray(0); glEnableVertexAttribArray(1);
            glVertexAttribPointer(0, 2, GL_FLOAT, 0, 16, std::ptr::null());
            glVertexAttribPointer(1, 2, GL_FLOAT, 0, 16, 8 as *const c_void);
            glDrawArrays(0x0005, 0, 4); // GL_TRIANGLE_STRIP
            glDisableVertexAttribArray(1);
            if manos.is_empty() || estilo < 0 { return; }
            // ---- las manos ----
            if estilo == 1 { self.medir_piel(rgba, bw, bh, &manos[0]); }
            self.malla.limpiar();
            for m in manos { self.malla.mano(&m.pts, grosor, estilo == 3); }
            let nv = self.malla.vertices();
            if nv == 0 { return; }
            glUseProgram(self.mano);
            // de píxeles de la imagen a la pantalla (x, y) y una profundidad que entra en [−1, 1]
            glUniform4f(self.u_xf, 2.0 * esc / vw as f32, -2.0 * esc / vh as f32, 2.0 * ox / vw as f32 - 1.0, 1.0 - 2.0 * oy / vh as f32);
            glUniform1f(self.u_z, 1.0 / (4.0 * bw.max(bh) as f32));
            glUniform1i(self.u_estilo, estilo);
            glUniform3f(self.u_piel, self.piel[0], self.piel[1], self.piel[2]);
            glUniform1f(self.u_tiempo, tiempo);
            glBindBuffer(GL_ARRAY_BUFFER, self.vb);
            glBufferData(GL_ARRAY_BUFFER, (self.malla.v.len() * 4) as isize, self.malla.v.as_ptr() as *const c_void, GL_STREAM_DRAW);
            glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, self.ib);
            glBufferData(GL_ELEMENT_ARRAY_BUFFER, (self.malla.i.len() * 2) as isize, self.malla.i.as_ptr() as *const c_void, GL_STREAM_DRAW);
            let paso = (POR_VERTICE * 4) as i32;
            glEnableVertexAttribArray(0); glEnableVertexAttribArray(1); glEnableVertexAttribArray(2);
            glVertexAttribPointer(0, 3, GL_FLOAT, 0, paso, std::ptr::null());
            glVertexAttribPointer(1, 3, GL_FLOAT, 0, paso, 12 as *const c_void);
            glVertexAttribPointer(2, 2, GL_FLOAT, 0, paso, 24 as *const c_void);
            let n = self.malla.i.len() as i32;
            glEnable(GL_DEPTH_TEST);
            glEnable(GL_BLEND); glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
            if estilo == 0 {
                // cristal: primero sólo la profundidad, después el color de la cara de adelante (sin las de atrás)
                glColorMask(0, 0, 0, 0); glDepthMask(1); glDepthFunc(GL_LESS);
                glDrawElements(GL_TRIANGLES, n, GL_UNSIGNED_SHORT, std::ptr::null());
                glColorMask(1, 1, 1, 1); glDepthMask(0); glDepthFunc(GL_LEQUAL);
                glDrawElements(GL_TRIANGLES, n, GL_UNSIGNED_SHORT, std::ptr::null());
                glDepthMask(1);
            } else {
                glDepthMask(1); glDepthFunc(GL_LESS);
                glDrawElements(GL_TRIANGLES, n, GL_UNSIGNED_SHORT, std::ptr::null());
            }
            glDisableVertexAttribArray(1); glDisableVertexAttribArray(2);
            glDisable(GL_BLEND); glDisable(GL_DEPTH_TEST);
        }
    }
}
