//! El celular en la mano en primera persona (celmVista, celmPosar y celmVistaDibujar de celumano.js): la vista «Hands» (sin
//! la mano izquierda) con la mano derecha sosteniendo el celular. La pose se resuelve una vez con la cámara en el origen
//! (cambia sólo con el tamaño de la pantalla o el campo de visión) y cada cuadro se lleva a la cámara. Hijo de vista.rs.
use super::*;
use crate::celu_ik::{self as ik, Esqueleto, Pose};

/// la vista Hands con los nombres de sus huesos
struct ManoEsq<'a> { v: &'a mut Vista, n: &'a [String] }
impl Esqueleto for ManoEsq<'_> {
    fn idx(&self, n: &str) -> Option<usize> { self.n.iter().position(|x| x == n) }
    fn pos(&self, i: usize) -> V { [self.v.w[i][12], self.v.w[i][13], self.v.w[i][14]] }
    fn qmundo(&self, i: usize) -> Q { m4quat(&self.v.w[i]) }
    fn qpadre(&self, i: usize) -> Q { let pa = self.v.pa[i]; if pa >= 0 { m4quat(&self.v.w[pa as usize]) } else { m4quat(&self.v.raiz) } }
    fn r(&self, i: usize) -> Q { self.v.r[i] }
    fn poner_r(&mut self, i: usize, q: Q) { self.v.r[i] = q; }
    fn actualizar(&mut self) { self.v.actualizar(); }
}
/// el giro de una matriz (sin su escala)
fn m4quat(m: &M4) -> Q {
    let c = |o: usize| { let v = [m[o], m[o + 1], m[o + 2]]; let l = (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]).sqrt().max(1e-12); [v[0] / l, v[1] / l, v[2] / l] };
    ik::q_base(c(0), c(4), c(8))
}
/// la pose resuelta (CELM.sol): para qué pantalla y campo de visión, los giros, la raíz y el celular, con la cámara en el origen
struct Sol { clave: (u32, u32, u32, bool), r: Vec<Q>, raiz: M4, p: Pose, pub dedos: [f32; 4] }
pub struct ManoCelu { pub v: Vista, nombres: Vec<String>, base: Vec<Q>, sol: Option<Sol>, pub pose: Option<Pose> }
impl ManoCelu {
    /// la vista Hands (y la escena con lo que el motor todavía no tiene)
    pub fn cargar(paq: &mut Paquete, ya: &mut Cargados) -> Result<(ManoCelu, Escena), String> {
        let (mut v, e) = Vista::cargar(paq, "Hands", "", 512, ya)?;
        let clave = crate::objetos::por_nombre(&paq.d).get("PhotonPlayer").cloned().ok_or("no está el PhotonPlayer")?;
        let arb = paq.d["pf"][&clave].as_array().ok_or("PhotonPlayer raro")?;
        let ws = arb.iter().position(|n| n["n"].as_str() == Some("WalkSway")).ok_or("no está WalkSway")? as i64;
        let i0 = arb.iter().position(|n| n["pa"].as_i64() == Some(ws) && n["n"].as_str() == Some("Hands")).ok_or("no están las manos")?;
        let nombres: Vec<String> = sub_arbol(arb, i0).iter().map(|x| x["n"].as_str().unwrap_or("").to_string()).collect();
        // (sin la mano izquierda: el brazo y la mano los pone la cinemática inversa)
        if let Some(il) = nombres.iter().position(|n| n == "low_poly_hand_l_update") { v.act[il] = false; }
        let base = v.r.clone();
        Ok((ManoCelu { v, nombres, base, sol: None, pose: None }, e))
    }
    /// cada cuadro: la mano y el celular delante de la cámara (lugar y giro), con un poco del vaivén del arma; `fov` el campo
    /// de visión vertical con que se dibuja (grados) y `asp` ancho/alto. Devuelve el celular en el mundo
    pub fn ubicar(&mut self, cam: V, cq: Q, fov: f32, asp: f32, tactil: bool, sway: [f32; 5]) -> Option<Pose> {
        let clave = ((fov * 100.0) as u32, (asp * 1000.0) as u32, 0, tactil);
        if self.sol.as_ref().map(|s| s.clave != clave).unwrap_or(true) { self.sol = self.resolver(fov, asp, tactil).map(|(r, raiz, p, dedos)| Sol { clave, r, raiz, p, dedos }); }
        let s = self.sol.as_ref()?;
        let off = [-sway[0] * 0.3, sway[1] * 0.3, sway[2] * 0.3]; let cp = ik::add(cam, ik::qrot(cq, off));
        self.v.r.clone_from(&s.r);
        self.v.raiz = m4::mul(&trs(cp, cq, [1.0; 3]), &s.raiz); self.v.actualizar();
        let p = Pose { c: ik::add(cp, ik::qrot(cq, s.p.c)), r: ik::qrot(cq, s.p.r), u: ik::qrot(cq, s.p.u), n: ik::qrot(cq, s.p.n), t: 1.0 };
        self.pose = Some(p); Some(p)
    }
    /// cuánto se dobló cada dedo en la pose resuelta (CELM.dedos)
    pub fn dedos(&self) -> Option<[f32; 4]> { self.sol.as_ref().map(|s| s.dedos) }
    fn resolver(&mut self, fov: f32, asp: f32, tactil: bool) -> Option<(Vec<Q>, M4, Pose, [f32; 4])> {
        self.v.r.clone_from(&self.base);
        let (p0, cam) = ik::pose_camara([0.0, 0.0, 0.0, 1.0], [0.0; 3], fov, asp, tactil);
        // (la escala: la mano mide lo que mide una mano, 18,5 cm de la muñeca a la punta del mayor)
        self.v.ubicar([0.0; 3], [0.0, 0.0, 0.0, 1.0], [0.0; 5], 0.0);
        let (h, m4i) = (self.nombres.iter().position(|n| n == "RightHand")?, self.nombres.iter().position(|n| n == "RightHandMiddle4")?);
        let l = { let (a, b) = (self.v.w[h], self.v.w[m4i]); ((a[12] - b[12]).powi(2) + (a[13] - b[13]).powi(2) + (a[14] - b[14]).powi(2)).sqrt() }; let l = if l > 0.0 { l } else { 0.05 };
        let e = 0.3 * 0.185 / l; self.v.raiz = trs([0.0; 3], [0.0, 0.0, 0.0, 1.0], [e; 3]); self.v.actualizar();
        let nombres = self.nombres.clone(); let mut esq = ManoEsq { v: &mut self.v, n: &nombres };
        let dedos = ik::posar(&mut esq, &p0, cam, &mut |md: &mut ManoEsq, dh: V| { md.v.raiz[12] += dh[0]; md.v.raiz[13] += dh[1]; md.v.raiz[14] += dh[2]; })?;
        Some((self.v.r.clone(), self.v.raiz, p0, dedos))
    }
    /// lo que se dibuja (sin sombra: va pegado a la cámara)
    pub fn items(&self, out: &mut Vec<ItemDin>) { self.v.items(out); }
    /// (para las pruebas) el esqueleto: dónde está cada hueso de la mano y del celular
    pub fn punto_hueso(&self, n: &str) -> Option<V> { let i = self.nombres.iter().position(|x| x == n)?; Some([self.v.w[i][12], self.v.w[i][13], self.v.w[i][14]]) }
    pub fn huesos_mano(&self) -> Vec<(String, V)> { self.nombres.iter().enumerate().filter(|(_, n)| n.starts_with("RightHand")).map(|(i, n)| (n.clone(), [self.v.w[i][12], self.v.w[i][13], self.v.w[i][14]])).collect() }
}
impl Vista {
    /// vistaUbicar con el corrimiento del arma a gusto (armaAjAplicar: después de apuntar y antes del vaivén)
    pub fn ubicar_aj(&mut self, cam: V, cam_q: Q, sway: [f32; 5], k: f32, aj: Option<M4>) {
        self.raiz = self.raiz_aj(cam, cam_q, sway, k, aj); self.actualizar();
    }
    /// dónde iría la raíz del arma (como ubicar_aj, sin moverla): JX Turbo corre el arma de los cuadros intermedios con esto
    pub fn raiz_aj(&self, cam: V, cam_q: Q, sway: [f32; 5], k: f32, aj: Option<M4>) -> M4 {
        let mut b = trs(cam, cam_q, [1.0; 3]);
        if let (Some((q, t)), true) = (self.ads, k > 0.002) { let qk = slerp([0.0, 0.0, 0.0, 1.0], q, k); b = m4::mul(&b, &trs([t[0] * k, t[1] * k, t[2] * k], qk, [1.0; 3])); }
        if let Some(a) = aj { b = m4::mul(&b, &a); }
        let sw = 1.0 - 0.85 * k;
        let o = trs([sway[0] * sw, sway[1] * sw, sway[2] * sw], [sway[3] * sw, sway[4] * sw, 0.0, 1.0], [0.3; 3]);
        m4::mul(&b, &o)
    }
}
