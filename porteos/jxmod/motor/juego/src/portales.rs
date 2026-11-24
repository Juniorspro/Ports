//! Las puertas portal de los mapas (linked_portal_door, del addon World Portals de GMod; portales.js): cada una tiene su
//! compañera en otra parte del mapa y al cruzarla de adelante hacia atrás, por adentro de su rectángulo, se sale por la
//! compañera con la misma dirección y velocidad (media vuelta sobre el eje de arriba: se sigue de largo).
use crate::bsp::PortalBsp;

pub type V = [f32; 3];
/// una puerta, su compañera y de qué lado estaba el jugador en el paso anterior (lo de adelante: lx)
#[derive(Clone, Debug)]
pub struct Portal { pub d: PortalBsp, pub b: Option<usize>, lx: Option<f32> }
#[derive(Default)]
pub struct Portales { pub l: Vec<Portal>, pub saltos: u32 }

impl Portales {
    /// portalesMapa
    pub fn nuevo(ps: &[PortalBsp]) -> Portales {
        let l = ps.iter().enumerate().map(|(i, d)| Portal { d: d.clone(), b: ps.iter().enumerate().position(|(j, x)| j != i && x.n == d.par), lx: None }).collect();
        Portales { l, saltos: 0 }
    }
    /// un punto respecto de una puerta: [adelante, derecha, arriba]
    pub fn local(d: &PortalBsp, p: V) -> V { let (x, y, z) = (p[0] - d.o[0], p[1] - d.o[1], p[2] - d.o[2]); [x * d.f[0] + y * d.f[1] + z * d.f[2], x * d.r[0] + y * d.r[1] + z * d.r[2], x * d.u[0] + y * d.u[1] + z * d.u[2]] }
    /// porPunto: lo que está a x delante de A queda a x detrás de la compañera
    pub fn punto(&self, a: usize, p: V) -> V { let l = Self::local(&self.l[a].d, p); let b = &self.l[self.l[a].b.unwrap()].d; [0, 1, 2].map(|k| b.o[k] - b.f[k] * l[0] - b.r[k] * l[1] + b.u[k] * l[2]) }
    /// porDir
    pub fn dir(&self, a: usize, v: V) -> V {
        let d = &self.l[a].d; let (x, y, z) = (v[0] * d.f[0] + v[1] * d.f[1] + v[2] * d.f[2], v[0] * d.r[0] + v[1] * d.r[1] + v[2] * d.r[2], v[0] * d.u[0] + v[1] * d.u[1] + v[2] * d.u[2]);
        let b = &self.l[self.l[a].b.unwrap()].d; [0, 1, 2].map(|k| -b.f[k] * x - b.r[k] * y + b.u[k] * z)
    }
    /// portalesPaso: si el jugador cruzó, dónde sale, con qué velocidad y mirando hacia dónde (`quieto`: en un vehículo o muerto)
    pub fn paso(&mut self, pos: V, vel: V, yaw: f32, quieto: bool) -> Option<(V, V, f32)> {
        if self.l.is_empty() { return None; }
        if quieto { for d in self.l.iter_mut() { d.lx = None; } return None; }
        for i in 0..self.l.len() {
            let Some(b) = self.l[i].b else { continue };
            let d = &self.l[i].d; let l = Self::local(d, pos);
            let dentro = l[1].abs() <= d.w && l[2] >= -d.h - 1.2 && l[2] <= d.h + 0.4 && l[0].abs() < 1.5;
            if dentro && self.l[i].lx.map(|x| x >= 0.0).unwrap_or(false) && l[0] < 0.0 {
                let fw = self.dir(i, [yaw.sin(), 0.0, yaw.cos()]); let np = self.punto(i, pos); let nv = self.dir(i, vel);
                for e in self.l.iter_mut() { e.lx = None; }
                self.l[b].lx = Some(Self::local(&self.l[b].d, np)[0]); self.saltos += 1;
                return Some((np, nv, fw[0].atan2(fw[2])));
            }
            self.l[i].lx = if dentro { Some(l[0]) } else { None };
        }
        None
    }
}

#[cfg(test)]
mod prueba {
    use super::*;
    /// dos puertas mirándose de frente a 10 m: se cruza la primera y se sale por delante de la otra, siguiendo de largo
    #[test]
    fn cruzar() {
        let a = PortalBsp { n: "a".into(), par: "b".into(), o: [0.0, 1.0, 0.0], f: [0.0, 0.0, 1.0], r: [-1.0, 0.0, 0.0], u: [0.0, 1.0, 0.0], w: 0.8, h: 1.2 };
        let b = PortalBsp { n: "b".into(), par: "a".into(), o: [0.0, 1.0, 10.0], f: [0.0, 0.0, -1.0], r: [1.0, 0.0, 0.0], u: [0.0, 1.0, 0.0], w: 0.8, h: 1.2 };
        let mut p = Portales::nuevo(&[a, b]);
        let yaw = std::f32::consts::PI; // (mirando hacia −z: hacia la puerta a desde adelante)
        assert!(p.paso([0.0, 1.0, 0.3], [0.0, 0.0, -3.0], yaw, false).is_none());
        let (np, nv, ny) = p.paso([0.0, 1.0, -0.05], [0.0, 0.0, -3.0], yaw, false).unwrap();
        assert!((np[2] - 9.95).abs() < 1e-4 && (nv[2] + 3.0).abs() < 1e-4 && (ny.abs() - std::f32::consts::PI).abs() < 1e-4);
        assert!(p.paso([0.0, 1.0, 9.9], [0.0, 0.0, -3.0], ny, false).is_none());
    }
}
