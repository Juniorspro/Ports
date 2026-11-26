//! Lo que tarda la placa en cada cuadro, sin frenarla: los medidores de tiempo de la placa (GL_EXT_disjoint_timer_query, o
//! ARB_timer_query en la compu). Cada cuadro abre un medidor y lo cierra; el resultado se lee unos cuadros después, cuando
//! ya está (sin esperar). Antes se esperaba a que la placa terminara todo (glFinish) cada 60 cuadros: con JX Turbo —120
//! cuadros por segundo— eso era un tirón dos veces por segundo. Lleva aparte los cuadros de verdad y los intermedios.
use glow::HasContext;

const N: usize = 8;
/// (lo de la extensión: si la placa perdió la cuenta en el medio —cambió de frecuencia, otra app—, ese resultado no sirve)
const GPU_DISJOINT: u32 = 0x8FBB;

pub struct Reloj {
    qs: Vec<(glow::Query, bool, bool)>,
    abierta: Option<usize>,
    /// lo que tarda la placa (ms, promediado): un cuadro de verdad y uno intermedio; 0 si todavía no se midió
    pub real_ms: f32, pub inter_ms: f32,
    /// cuántos se midieron
    pub n: u32,
    disjunto: bool,
}

impl Reloj {
    /// None si la placa no tiene los medidores
    pub unsafe fn nuevo(gl: &glow::Context) -> Option<Reloj> {
        if std::env::var_os("JXM_SIN_RELOJ").is_some() { return None; }
        let ext = gl.supported_extensions();
        if !(ext.contains("GL_EXT_disjoint_timer_query") || ext.contains("GL_ARB_timer_query") || ext.contains("GL_EXT_timer_query")) { return None; }
        let mut qs = vec![];
        for _ in 0..N { qs.push((gl.create_query().ok()?, false, false)); }
        while gl.get_error() != glow::NO_ERROR {}
        Some(Reloj { qs, abierta: None, real_ms: 0.0, inter_ms: 0.0, n: 0, disjunto: ext.contains("GL_EXT_disjoint_timer_query") })
    }
    /// abre el medidor de este cuadro (si hay uno libre)
    pub unsafe fn empezar(&mut self, gl: &glow::Context) {
        self.leer(gl);
        if self.abierta.is_some() { return; }
        let Some(i) = self.qs.iter().position(|q| !q.1) else { return };
        gl.begin_query(glow::TIME_ELAPSED, self.qs[i].0);
        self.qs[i].1 = true; self.abierta = Some(i);
    }
    /// lo cierra: `inter` dice si fue un cuadro intermedio
    pub unsafe fn terminar(&mut self, gl: &glow::Context, inter: bool) {
        let Some(i) = self.abierta.take() else { return };
        gl.end_query(glow::TIME_ELAPSED); self.qs[i].2 = inter;
    }
    /// los que ya están: al promedio
    unsafe fn leer(&mut self, gl: &glow::Context) {
        let mut perdida = false;
        for k in 0..self.qs.len() {
            let (q, vuelo, inter) = self.qs[k];
            if !vuelo || self.abierta == Some(k) { continue; }
            if gl.get_query_parameter_u32(q, glow::QUERY_RESULT_AVAILABLE) == 0 { continue; }
            if !perdida && self.disjunto { perdida = gl.get_parameter_i32(GPU_DISJOINT) != 0; }
            let ns = gl.get_query_parameter_u32(q, glow::QUERY_RESULT) as f32;
            self.qs[k].1 = false;
            if perdida || ns <= 0.0 { continue; }
            let ms = ns / 1e6; let x = if inter { &mut self.inter_ms } else { &mut self.real_ms };
            *x = if *x == 0.0 { ms } else { *x * 0.85 + ms * 0.15 };
            self.n += 1;
        }
    }
}
