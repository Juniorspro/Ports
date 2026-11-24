//! El celular en la mano de un personaje en tercera persona (celmBrazo3p de celumano.js): el brazo derecho lo sostiene
//! delante del pecho con la pantalla mirando a la cara; los dedos se calculan una vez por personaje y después se copian.
//! Hijo de personaje.rs (va después de `animar`).
use super::*;
use crate::celu_ik::{self as ik, Esqueleto, Pose};

impl Esqueleto for Personaje {
    fn idx(&self, n: &str) -> Option<usize> {
        if let Some(k) = HUESOS.iter().position(|x| *x == n) { if let Some(i) = self.h[k] { return Some(i); } }
        self.nodo_humano(n)
    }
    fn pos(&self, i: usize) -> V { pos(&self.w[i]) }
    fn qmundo(&self, i: usize) -> Q { m4quat(&self.w[i]) }
    fn qpadre(&self, i: usize) -> Q { let pa = self.pa[i]; if pa >= 0 { m4quat(&self.w[pa as usize]) } else { m4quat(&self.raiz) } }
    fn r(&self, i: usize) -> Q { self.r[i] }
    fn poner_r(&mut self, i: usize, q: Q) { self.r[i] = q; }
    fn actualizar(&mut self) { Personaje::actualizar(self); }
    fn reposo_r(&self, i: usize) -> Option<Q> { self.reposo.1.get(i).copied() }
}
impl Personaje {
    /// con el celular en la mano (y sin emote, ni sentado, ni muñeco): el brazo lo sostiene y devuelve el celular (en el
    /// espacio del personaje: con `base` va al mundo). `dedos`: los giros de los dedos, de la vez anterior o para guardar
    pub fn celu_3p(&mut self, dedos: &mut Option<Vec<(usize, Q)>>) -> Option<Pose> {
        if self.en_emo() || self.sentado.is_some() || self.rag { return None; }
        let t = if self.tam > 0.0 { self.tam } else { 1.0 };
        // (los dedos se calculan una vez por personaje, desde su reposo, y después se copian)
        let p = ik::brazo_3p(self, t, dedos)?;
        self.calcular_paleta();
        Some(p)
    }
}
