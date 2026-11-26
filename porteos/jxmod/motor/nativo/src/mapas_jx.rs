//! Los mapas propios de JXMod hechos con las texturas de GMod y Half-Life 2 de la biblioteca (gm_lib: la que ya baja la
//! app para los addons y los mapas del Workshop). Se arman acá, en código: cajas, rampas y paredes con su material de
//! Source (gm_material: el .vmt y su .vtf), las UV en metros como en Hammer (una textura de 512 cada 3,25 m), todo lo que se
//! ve también choca, el cielo pintado de GMod y la luz como la de los mapas del Workshop. El primero: JX_Plaza.
use super::mapas_juego::malla_de;
use super::*;
use jxjuego::bsp::{MatRef, Pieza};
use jxjuego::mapa::LuzBase;
use jxmotor::escena::{Caras, Cielo, ItemDin, Niebla};

const ID_JX: i64 = -8_500_000;
/// los mapas que hay (nombre interno, el que se ve)
pub const MAPAS_JX: [(&str, &str); 1] = [("JX_Plaza", "JX Plaza")];

/// lo que se va armando: los vértices, por material sus índices y lo que choca
#[derive(Default)]
struct Obra { p: Vec<[f32; 3]>, n: Vec<[f32; 3]>, uv: Vec<[f32; 2]>, por: Vec<(String, Vec<u32>)>, choque: Vec<f32>, spawns: Vec<([f32; 3], Option<f32>)> }
impl Obra {
    /// cuántos metros cubre una vez la textura (las de Source: 512 texeles a 0,25 unidades de 2,54 cm)
    fn tam(mat: &str) -> f32 {
        if mat.starts_with("building_template") { 8.0 } else if mat.contains("cliff") || mat.contains("dirtwall") { 6.5 } else if mat.contains("ps_grass") { 4.0 }
        else if mat.contains("road") { 6.0 } else { 3.25 }
    }
    /// un cuadrilátero (en orden alrededor) con su normal; UV del plano de la normal en metros
    fn cara(&mut self, mat: &str, q: [[f32; 3]; 4], n: [f32; 3]) {
        let t = Self::tam(mat); let base = self.p.len() as u32;
        let (a, b) = if n[1].abs() > 0.7 { (0usize, 2usize) } else if n[0].abs() > 0.7 { (2, 1) } else { (0, 1) };
        for v in q { self.p.push(v); self.n.push(n); self.uv.push([v[a] / t, -v[b] / t]); }
        let ix = [base, base + 1, base + 2, base, base + 2, base + 3];
        match self.por.iter_mut().find(|x| x.0 == mat) { Some(x) => x.1.extend_from_slice(&ix), None => self.por.push((mat.to_string(), ix.to_vec())) }
        for t in [[0, 1, 2], [0, 2, 3]] { for k in t { self.choque.extend_from_slice(&q[k]); } }
    }
    /// una caja de `lo` a `hi` con los costados de un material y arriba de otro (abajo, sólo si `abajo`)
    fn caja(&mut self, lados: &str, arriba: &str, lo: [f32; 3], hi: [f32; 3], abajo: bool) {
        let [x0, y0, z0] = lo; let [x1, y1, z1] = hi;
        self.cara(arriba, [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], [0.0, 1.0, 0.0]);
        if abajo { self.cara(lados, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0.0, -1.0, 0.0]); }
        self.cara(lados, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0.0, 0.0, 1.0]);
        self.cara(lados, [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0.0, 0.0, -1.0]);
        self.cara(lados, [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1.0, 0.0, 0.0]);
        self.cara(lados, [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1.0, 0.0, 0.0]);
    }
    /// una rampa que sube a lo largo de +x de `y0` a `y1` (de ancho en z), con sus costados
    fn rampa(&mut self, mat: &str, x0: f32, x1: f32, z0: f32, z1: f32, y0: f32, y1: f32) {
        let (dx, dy) = (x1 - x0, y1 - y0); let l = (dx * dx + dy * dy).sqrt(); let n = [-dy / l, dx / l, 0.0];
        self.cara(mat, [[x0, y0, z0], [x0, y0, z1], [x1, y1, z1], [x1, y1, z0]], n);
        self.cara(mat, [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], [1.0, 0.0, 0.0]);
        for (z, nz) in [(z0, -1.0), (z1, 1.0)] { let b = self.p.len() as u32; let t = Self::tam(mat);
            for v in [[x0, y0, z], [x1, y0, z], [x1, y1, z]] { self.p.push(v); self.n.push([0.0, 0.0, nz]); self.uv.push([v[0] / t, -v[1] / t]); }
            let ix = if nz > 0.0 { [b, b + 1, b + 2] } else { [b, b + 2, b + 1] };
            match self.por.iter_mut().find(|x| x.0 == mat) { Some(x) => x.1.extend_from_slice(&ix), None => self.por.push((mat.to_string(), ix.to_vec())) }
            for k in ix { self.choque.extend_from_slice(&self.p[k as usize]); } }
    }
    /// un edificio: la fachada en los costados, el techo de concreto y una puerta (un hueco al frente, hacia -z)
    fn edificio(&mut self, fachada: &str, x0: f32, z0: f32, w: f32, d: f32, alto: f32) {
        let (x1, z1) = (x0 + w, z0 + d); let pw = 2.4f32.min(w * 0.3); let px = x0 + (w - pw) / 2.0;
        // (el frente en tres pedazos alrededor de la puerta y el resto entero; adentro, piso de baldosas)
        self.cara(fachada, [[x0, 0.0, z0], [x0, 0.0, z1], [x0, alto, z1], [x0, alto, z0]], [-1.0, 0.0, 0.0]);
        self.cara(fachada, [[x1, 0.0, z1], [x1, 0.0, z0], [x1, alto, z0], [x1, alto, z1]], [1.0, 0.0, 0.0]);
        self.cara(fachada, [[x0, 0.0, z1], [x1, 0.0, z1], [x1, alto, z1], [x0, alto, z1]], [0.0, 0.0, 1.0]);
        self.cara(fachada, [[px, 0.0, z0], [x0, 0.0, z0], [x0, alto, z0], [px, alto, z0]], [0.0, 0.0, -1.0]);
        self.cara(fachada, [[x1, 0.0, z0], [px + pw, 0.0, z0], [px + pw, alto, z0], [x1, alto, z0]], [0.0, 0.0, -1.0]);
        self.cara(fachada, [[px + pw, 3.0, z0], [px, 3.0, z0], [px, alto, z0], [px + pw, alto, z0]], [0.0, 0.0, -1.0]);
        self.cara("concrete/concretefloor020a", [[x0, alto, z0], [x0, alto, z1], [x1, alto, z1], [x1, alto, z0]], [0.0, 1.0, 0.0]);
        // (adentro: las paredes de revoque, mirando para adentro, y el piso)
        let e = 0.25; let (a0, a1, b0, b1) = (x0 + e, x1 - e, z0 + e, z1 - e); let h = 3.2f32.min(alto - 0.3);
        self.cara("tile/tilefloor001c", [[a0, 0.02, b0], [a0, 0.02, b1], [a1, 0.02, b1], [a1, 0.02, b0]], [0.0, 1.0, 0.0]);
        self.cara("plaster/plasterwall034a", [[a1, 0.0, b0], [a1, 0.0, b1], [a1, h, b1], [a1, h, b0]], [-1.0, 0.0, 0.0]);
        self.cara("plaster/plasterwall034a", [[a0, 0.0, b1], [a0, 0.0, b0], [a0, h, b0], [a0, h, b1]], [1.0, 0.0, 0.0]);
        self.cara("plaster/plasterwall034a", [[a1, 0.0, b1], [a0, 0.0, b1], [a0, h, b1], [a1, h, b1]], [0.0, 0.0, -1.0]);
        self.cara("plaster/plasterceiling008a", [[a0, h, b1], [a0, h, b0], [a1, h, b0], [a1, h, b1]], [0.0, -1.0, 0.0]);
    }
}

/// JX Plaza: una manzana de 160 m con dos calles que se cruzan, veredas, una plaza de baldosas con una tarima de cuadros,
/// edificios con fachadas de HL2, un galpón de chapa abierto, rampas de madera y caños, todo cerrado por paredes de roca
fn plaza() -> Obra {
    let mut o = Obra::default(); let l = 80.0;
    // el pasto y las calles (en cruz, de 10 m) con su vereda de 3 m (un escalón de 15 cm)
    for (x0, z0, x1, z1) in [(-l, -l, -8.0, -8.0), (8.0, -l, l, -8.0), (-l, 8.0, -8.0, l), (8.0, 8.0, l, l)] { o.cara("phoenix_storms/ps_grass", [[x0, 0.0, z0], [x0, 0.0, z1], [x1, 0.0, z1], [x1, 0.0, z0]], [0.0, 1.0, 0.0]); }
    o.cara("phoenix_storms/road", [[-l, 0.0, -5.0], [-l, 0.0, 5.0], [l, 0.0, 5.0], [l, 0.0, -5.0]], [0.0, 1.0, 0.0]);
    o.cara("phoenix_storms/road", [[-5.0, 0.0, -l], [-5.0, 0.0, -5.0], [5.0, 0.0, -5.0], [5.0, 0.0, -l]], [0.0, 1.0, 0.0]);
    o.cara("phoenix_storms/road", [[-5.0, 0.0, 5.0], [-5.0, 0.0, l], [5.0, 0.0, l], [5.0, 0.0, 5.0]], [0.0, 1.0, 0.0]);
    for s in [-1.0f32, 1.0] {
        o.caja("concrete/concretewall019a", "phoenix_storms/roadside", [-l, 0.0, if s > 0.0 { 5.0 } else { -8.0 }], [-8.0, 0.15, if s > 0.0 { 8.0 } else { -5.0 }], false);
        o.caja("concrete/concretewall019a", "phoenix_storms/roadside", [8.0, 0.0, if s > 0.0 { 5.0 } else { -8.0 }], [l, 0.15, if s > 0.0 { 8.0 } else { -5.0 }], false);
        o.caja("concrete/concretewall019a", "phoenix_storms/roadside", [if s > 0.0 { 5.0 } else { -8.0 }, 0.0, -l], [if s > 0.0 { 8.0 } else { -5.0 }, 0.15, -8.0], false);
        o.caja("concrete/concretewall019a", "phoenix_storms/roadside", [if s > 0.0 { 5.0 } else { -8.0 }, 0.0, 8.0], [if s > 0.0 { 8.0 } else { -5.0 }, 0.15, l], false);
    }
    // (las cuatro esquinas del cruce, donde se juntan las veredas)
    for (x, z) in [(5.0, 5.0), (-8.0, 5.0), (5.0, -8.0), (-8.0, -8.0)] { o.caja("concrete/concretewall019a", "phoenix_storms/roadside", [x, 0.0, z], [x + 3.0, 0.15, z + 3.0], false); }
    // la plaza (al noreste): baldosas, la tarima de cuadros con su escalón y bancos de concreto
    o.caja("concrete/concretewall064b", "phoenix_storms/tiles2", [12.0, 0.0, 12.0], [44.0, 0.2, 44.0], false);
    o.caja("phoenix_storms/metal_plate", "phoenix_storms/checkers_map", [22.0, 0.2, 22.0], [34.0, 1.0, 34.0], false);
    o.caja("concrete/concretewall064b", "concrete/concretefloor010a", [20.0, 0.2, 26.0], [22.0, 0.6, 30.0], false);
    for (x, z) in [(14.0, 16.0), (14.0, 38.0), (40.0, 16.0), (40.0, 38.0)] { o.caja("concrete/concretewall066a", "concrete/concretefloor013a", [x, 0.2, z], [x + 3.0, 0.65, z + 0.8], false); }
    // los edificios (al noroeste y al sudeste), con la puerta hacia la calle
    o.edificio("building_template/building_template010a", -40.0, 12.0, 18.0, 16.0, 14.0);
    o.edificio("building_template/building_template022j", -66.0, 12.0, 16.0, 18.0, 20.0);
    o.edificio("plaster/plasterwall021a", -40.0, 40.0, 26.0, 14.0, 8.0);
    o.edificio("building_template/building_template010a", 12.0, -36.0, 14.0, 12.0, 11.0);
    o.edificio("plaster/plasterwall039c", 32.0, -40.0, 20.0, 16.0, 7.0);
    // el galpón de chapa (al sudoeste): tres paredes, techo y piso de chapa; adentro, cajas
    let (gx0, gz0, gx1, gz1, gh) = (-60.0, -60.0, -24.0, -30.0, 9.0);
    o.cara("phoenix_storms/metalfloor_2-3", [[gx0, 0.03, gz0], [gx0, 0.03, gz1], [gx1, 0.03, gz1], [gx1, 0.03, gz0]], [0.0, 1.0, 0.0]);
    o.caja("metal/metalwall001a", "metal/metalwall001a", [gx0, 0.0, gz0], [gx0 + 0.4, gh, gz1], false);
    o.caja("metal/metalwall001a", "metal/metalwall001a", [gx1 - 0.4, 0.0, gz0], [gx1, gh, gz1], false);
    o.caja("metal/metalwall001a", "metal/metalwall001a", [gx0, 0.0, gz0], [gx1, gh, gz0 + 0.4], false);
    o.caja("metal/metalwall005b", "metal/metalwall005b", [gx0, gh, gz0], [gx1, gh + 0.4, gz1], true);
    for (x, z, s) in [(-55.0, -55.0, 2.0), (-52.0, -55.0, 2.0), (-55.0, -52.0, 1.5), (-34.0, -56.0, 2.5)] { o.caja("phoenix_storms/metalbox", "phoenix_storms/metalbox", [x, 0.0, z], [x + s, s, z + s], false); }
    // las rampas de madera (al sudeste) y un caño grande para pasar por adentro
    o.rampa("phoenix_storms/wood", 14.0, 30.0, -66.0, -58.0, 0.0, 4.0);
    o.caja("phoenix_storms/wood_side", "phoenix_storms/wood", [30.0, 0.0, -66.0], [38.0, 4.0, -58.0], false);
    o.rampa("phoenix_storms/wood", 54.0, 38.0, -66.0, -58.0, 0.0, 4.0);
    o.caja("phoenix_storms/construct/concrete_pipe_00", "phoenix_storms/construct/concrete_pipe_00", [50.0, 0.0, 20.0], [70.0, 0.4, 24.0], false);
    o.caja("phoenix_storms/construct/concrete_pipe_00", "phoenix_storms/construct/concrete_pipe_00", [50.0, 3.6, 20.0], [70.0, 4.0, 24.0], false);
    o.caja("phoenix_storms/construct/concrete_pipe_00", "phoenix_storms/construct/concrete_pipe_00", [50.0, 0.0, 19.6], [70.0, 4.0, 20.0], false);
    o.caja("phoenix_storms/construct/concrete_pipe_00", "phoenix_storms/construct/concrete_pipe_00", [50.0, 0.0, 24.0], [70.0, 4.0, 24.4], false);
    // la pérgola de fierros (al este): cuatro columnas y un techo de vigas con huecos —el sol pasa entre las vigas: con la luz en
    // el aire (Ultra) se ven los haces—
    let (px0, pz0, px1, pz1, ph) = (50.0f32, 30.0f32, 72.0f32, 52.0f32, 5.0f32);
    for (x, z) in [(px0, pz0), (px1 - 0.4, pz0), (px0, pz1 - 0.4), (px1 - 0.4, pz1 - 0.4)] { o.caja("metal/metalwall005b", "metal/metalwall005b", [x, 0.0, z], [x + 0.4, ph, z + 0.4], false); }
    for x in [px0, (px0 + px1) / 2.0 - 0.15, px1 - 0.3] { o.caja("metal/metalwall005b", "metal/metalwall005b", [x, ph, pz0], [x + 0.3, ph + 0.4, pz1], true); }
    let mut z = pz0; while z + 0.25 <= pz1 { o.caja("metal/metalwall001a", "metal/metalwall001a", [px0, ph + 0.4, z], [px1, ph + 0.7, z + 0.25], true); z += 1.1; }
    // las paredes de roca alrededor (que no se caiga del mapa)
    let r = 25.0;
    o.caja("nature/cliffface001a", "nature/dirtwall001a", [-l - 2.0, -1.0, -l - 2.0], [-l, r, l + 2.0], false);
    o.caja("nature/cliffface001a", "nature/dirtwall001a", [l, -1.0, -l - 2.0], [l + 2.0, r, l + 2.0], false);
    o.caja("nature/cliffface002a", "nature/dirtwall001a", [-l, -1.0, -l - 2.0], [l, r, -l], false);
    o.caja("nature/cliffface002a", "nature/dirtwall001a", [-l, -1.0, l], [l, r, l + 2.0], false);
    // dónde aparece: en el cruce de las calles, mirando a la plaza; y alrededor
    o.spawns = vec![([0.0, 0.1, 0.0], Some(std::f32::consts::FRAC_PI_4)), ([-3.0, 0.1, 3.0], None), ([3.0, 0.1, -3.0], None), ([0.0, 0.1, 12.0], None)];
    o
}

impl Juego {
    /// arma un mapa propio con las texturas de GMod (hace falta la biblioteca: rb_falta_carga la baja antes)
    pub(crate) fn mapa_jx(&mut self, m: &mut Motor3d, nombre: &str) -> Result<Mapa, String> {
        let o = match nombre { "JX_Plaza" => plaza(), _ => return Err(format!("no hay un mapa {nombre}")) };
        self.gmod_asegurar();
        // los materiales (uno por textura, de la biblioteca de GMod)
        let mut mats: Vec<i64> = vec![];
        for (mat, _) in &o.por { let (id, _) = self.gm_material(m, mat, &[]); mats.push(id); }
        let pz = Pieza { p: o.p.clone(), n: o.n.clone(), uv: o.uv.clone(), lm: vec![], por: o.por.iter().enumerate().map(|(i, x)| (MatRef::Tex(i as u32), x.1.clone())).collect(), c: vec![], cc: vec![], h: vec![], tren: false };
        let mut datos: Vec<u8> = vec![]; let mut mallas = vec![]; let mut items = vec![];
        let mat_de = |r: MatRef| -> Option<i64> { match r { MatRef::Tex(i) => mats.get(i as usize).copied(), _ => None } };
        if let Some((ml, partes, esf)) = malla_de(ID_JX, &pz, None, &mat_de, &mut datos) {
            for (s0, sn, mat) in partes { items.push(ItemDin { m: ml.id, s0, sn, mat, mm: m4::id(), esf, fl: 0, h: vec![] }); }
            mallas.push(ml);
        }
        // el cielo pintado de GMod y la luz de la tarde
        let caras = jxjuego::mapa::cielo_painted(64);
        let o_caras: Vec<usize> = caras.iter().map(|c| { while datos.len() % 4 != 0 { datos.push(0); } let x = datos.len(); datos.extend_from_slice(c); x }).collect();
        let (top, mid, bot) = ([126.0 / 255.0, 189.0 / 255.0, 1.0], [244.0 / 255.0, 246.0 / 255.0, 244.0 / 255.0], [126.0 / 255.0, 189.0 / 255.0, 1.0]);
        let cielo = Cielo { top, mid, bot, exp: [0.8, 1.0], tinte: [1.0; 3], dia: 1.0, k: 1.0, cubo: 1, caras: Some(Caras { l: 64, o: o_caras }) };
        let amb_s = [0, 1, 2].map(|k| (top[k] * 0.4 + mid[k] * 0.6) * 0.72); let amb_g = [0, 1, 2].map(|k| (mid[k] * 0.45 + bot[k] * 0.3) * 0.62);
        let lejos = 750.0;
        let base = LuzBase { sol: [0.42, 0.78, 0.46], sol_col: [1.0, 0.95, 0.86], amb_s, amb_g, nie: Niebla { c: mid, a: lejos * 0.7, b: lejos, m: 1.0, s: [0.0; 3] }, cielo: Cielo { caras: None, ..cielo.clone() } };
        let luz = jxjuego::mapa::luz_lineal(&base, 1.0);
        let mundo = jxjuego::mundo::Mundo::nuevo(o.choque.clone(), vec![], 1.0);
        let cab = Cabecera { mapa: nombre.to_string(), w: 0, h: 0, cam: None, luz: None, mallas, mats: vec![], texs: vec![], lms: vec![], items: vec![], agua: None, cielo: Some(cielo) };
        Ok(Mapa { nombre: nombre.to_string(), esc: Escena { c: cab, datos }, items, luz, luces: vec![], spawns: o.spawns, mundo, agua_y: None, aguas: vec![], lejos, base })
    }
}

#[cfg(test)]
mod pruebas {
    use super::*;
    #[test]
    fn la_plaza_cierra() {
        let o = plaza();
        assert_eq!(o.p.len(), o.n.len()); assert_eq!(o.p.len(), o.uv.len());
        assert!(o.por.iter().all(|x| x.1.len() % 3 == 0 && x.1.iter().all(|&i| (i as usize) < o.p.len())));
        assert!(o.choque.len() % 9 == 0 && o.choque.len() / 9 > 300, "{}", o.choque.len() / 9);
        assert!(o.por.len() >= 15, "{} materiales", o.por.len());
        assert!(!o.spawns.is_empty());
    }
}
