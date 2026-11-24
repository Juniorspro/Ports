//! Pill Packs (juego/pillpacks.js y pill_gmod.js), como el addon pk_pills de GMod: una pestaña del menú de GMod con
//! personajes para TRANSFORMARSE. Elegir uno es pasar a ser ese personaje: su cuerpo (un personaje del juego o el modelo
//! de un addon: gmod_pm.rs), la cámara en tercera persona a su distancia, su velocidad, su salto y su vida, y cuatro
//! habilidades con una barra de poder (los botones de disparo, el secundario, correr y recargar): el golpe, el susto (los
//! NPC de cerca huyen), la carrera, la cajita musical (bailan), el teletransporte, la cura, la embestida, el salto, la
//! ráfaga y el disparo. Los propios son los personajes del juego (los animatrónicos, los de terror, los de acción); los de
//! los Pill Packs del Workshop salen de pk_pills.register (jxgmod/pills.rs: su modelo, su vida, su velocidad, su salto, su
//! cámara, el golpe y el disparo de pk_pills.common y las funciones propias del addon). Volver: el menú o «Volver».
//! Lo que no (de la web): los niveles y la experiencia, la red (que los demás lo vean) y los ajustes de velocidad y recarga.
use super::*;
use jxgmod::{AtaquePill, PillGm};

const VEL_JUG: f32 = 6.0;
/// una habilidad (cada una con su tipo y lo suyo; las de mantener —carrera— gastan por segundo)
#[derive(Clone, Debug, Default)]
pub struct Hab {
    pub t: &'static str, pub costo: f32, pub cd: f32, pub dan: f32, pub alc: f32, pub imp: f32, pub radio: f32, pub son: String, pub cola: String,
    pub tope: f32, pub mult: f32, pub gasto: f32, pub dur: f32, pub cura: f32, pub vel: f32, pub alto: f32, pub laser: bool, pub num: u32, pub disp: f32,
    /// (los de un addon) sus sonidos: el golpe, el que pega, el que no pega, el disparo; y el ataque propio (0, 1, 2)
    pub s_gm: Vec<String>, pub s_pega: Vec<String>, pub s_falla: Vec<String>, pub lua: Option<usize>,
}
fn h_golpe(dan: f32, f: impl FnOnce(&mut Hab)) -> Option<Hab> { let mut h = Hab { t: "golpe", dan, alc: 1.9, cd: 0.8, imp: 0.2, ..Default::default() }; f(&mut h); Some(h) }
fn h_susto(f: impl FnOnce(&mut Hab)) -> Option<Hab> { let mut h = Hab { t: "susto", costo: 35.0, cd: 6.0, radio: 10.0, son: "fn_grito".into(), ..Default::default() }; f(&mut h); Some(h) }
fn h_carrera(tope: f32, f: impl FnOnce(&mut Hab)) -> Option<Hab> { let mut h = Hab { t: "carrera", tope, gasto: 18.0, ..Default::default() }; f(&mut h); Some(h) }
fn h(t: &'static str, costo: f32, cd: f32, f: impl FnOnce(&mut Hab)) -> Option<Hab> { let mut h = Hab { t, costo, cd, ..Default::default() }; f(&mut h); Some(h) }

/// un personaje para transformarse
#[derive(Clone, Debug)]
pub struct DefPill {
    pub id: String, pub nom: String, pub skin: String, pub vida: f32, pub vel: f32, pub salto: f32, pub cam: Option<f32>, pub cat: String, pub metal: bool,
    pub hab: [Option<Hab>; 4], pub pasos: Vec<String>, pub gm: Option<String>,
}
/// PILL_PROPIOS: los personajes del juego con lo que los hace distintos (por categoría: fnaf, terror, accion, mas)
pub fn propios() -> Vec<DefPill> {
    let d = |id: &str, skin: &str, nom: &str, vida: f32, vel: f32, salto: f32, cam: Option<f32>, cat: &str, metal: bool, hab: [Option<Hab>; 4]| {
        let mut hab = hab; for x in hab.iter_mut().flatten() { if x.t == "carrera" && x.tope > 0.0 { x.mult = x.tope / vel; } }
        let pasos = if cat == "fnaf" { vec!["fn_paso1".into(), "fn_paso2".into(), "fn_paso3".into()] } else { vec![] };
        DefPill { id: id.into(), nom: nom.into(), skin: skin.into(), vida, vel, salto, cam, cat: cat.into(), metal, hab, pasos, gm: None }
    };
    let (f, t, a) = (Some(3.9), Some(3.6), Some(3.4));
    vec![
        d("freddy", "Freddy", "Freddy Fazbear", 260.0, 6.0, 0.8, f, "fnaf", true, [h_golpe(30.0, |_| {}), h_susto(|h| h.cola = "fn_risa".into()), h_carrera(9.2, |_| {}), h("cajita", 50.0, 20.0, |h| { h.radio = 14.0; h.dur = 9.0; h.son = "fn_cajita".into(); })]),
        d("bonnie", "Bonnie", "Bonnie", 220.0, 6.4, 0.95, f, "fnaf", true, [h_golpe(26.0, |h| h.imp = 0.24), h_susto(|_| {}), h_carrera(10.2, |_| {}), h("tele", 40.0, 7.0, |h| { h.alc = 14.0; h.son = "fn_estatica".into(); })]),
        d("chica", "Chica", "Chica", 220.0, 6.3, 0.9, f, "fnaf", true, [h_golpe(26.0, |_| {}), h_susto(|_| {}), h_carrera(9.8, |_| {}), h("curar", 40.0, 14.0, |h| { h.cura = 70.0; h.son = "fn_ollas".into(); })]),
        d("foxy", "Foxy", "Foxy", 190.0, 7.0, 1.3, f, "fnaf", true, [h_golpe(22.0, |h| { h.cd = 0.6; h.imp = 0.22; }), h_susto(|_| {}), h_carrera(14.0, |h| { h.gasto = 22.0; h.son = "fn_foxycorre".into(); }), h("embestida", 30.0, 4.5, |h| { h.dan = 40.0; h.vel = 15.0; h.son = "fn_foxycorre".into(); })]),
        d("zombi", "Zombi", "Zombi", 240.0, 6.0, 0.8, t, "terror", false, [h_golpe(32.0, |h| h.cd = 1.0), h_susto(|h| { h.son = "VZ_z_muere1".into(); h.radio = 9.0; }), h_carrera(9.6, |_| {}), None]),
        d("boiled", "BoiledOne", "The Boiled One", 420.0, 6.0, 0.75, Some(4.6), "terror", false, [h_golpe(40.0, |h| { h.cd = 1.1; h.alc = 2.6; }), h_susto(|h| { h.son = "VZ_z_muere3".into(); h.radio = 14.0; }), h_carrera(9.0, |_| {}), h("tele", 45.0, 9.0, |h| { h.alc = 18.0; h.son = "VZ_z_dolor4".into(); })]),
        d("sunman", "Sunman", "Sunman", 320.0, 6.2, 1.0, Some(4.3), "terror", false, [h_golpe(34.0, |h| h.alc = 2.3), h_susto(|h| { h.son = "VZ_z_muere2".into(); h.radio = 12.0; }), h_carrera(9.6, |_| {}), None]),
        d("bon", "Bon", "Bon", 260.0, 6.3, 0.9, Some(4.0), "terror", false, [h_golpe(30.0, |_| {}), h_susto(|h| h.son = "VZ_r_muere1".into()), h_carrera(9.8, |_| {}), h("tele", 40.0, 8.0, |h| { h.alc = 14.0; h.son = "VZ_r_dolor1".into(); })]),
        d("sha", "Sha", "Sha", 220.0, 6.5, 1.0, t, "terror", false, [h_golpe(26.0, |_| {}), h_susto(|h| h.son = "VZ_r_muere1".into()), h_carrera(10.0, |_| {}), None]),
        d("partygoer", "Partygoer", "Partygoer", 220.0, 6.8, 1.2, t, "terror", false, [h_golpe(28.0, |_| {}), h_susto(|h| h.son = "VZ_z_muere1".into()), h_carrera(12.0, |_| {}), h("tele", 40.0, 8.0, |h| { h.alc = 14.0; h.son = "VZ_z_dolor2".into(); })]),
        d("bacteria", "Bacteria", "Bacteria", 300.0, 6.8, 1.3, Some(4.2), "terror", false, [h_golpe(36.0, |h| h.alc = 2.3), h_susto(|h| { h.son = "VZ_z_muere2".into(); h.radio = 12.0; }), h_carrera(13.0, |h| h.gasto = 24.0), h("embestida", 30.0, 5.0, |h| { h.dan = 45.0; h.vel = 16.0; h.son = "VZ_z_dolor5".into(); })]),
        d("alternate", "Alternate", "Alternate", 200.0, 6.3, 1.0, t, "terror", false, [h_golpe(24.0, |_| {}), h_susto(|h| h.son = "VZ_z_muere3".into()), h_carrera(9.6, |_| {}), h("tele", 40.0, 8.0, |h| { h.alc = 12.0; h.son = "VZ_z_dolor3".into(); })]),
        d("filbus", "Filbus", "Filbus", 210.0, 6.5, 1.1, t, "terror", false, [h_golpe(26.0, |_| {}), h_susto(|h| h.son = "VZ_z_muere1".into()), h_carrera(10.2, |_| {}), None]),
        d("goku", "Goku", "Goku", 260.0, 7.5, 2.4, a, "accion", false, [h_golpe(28.0, |h| { h.cd = 0.45; h.imp = 0.2; }), h("rafaga", 25.0, 1.2, |h| { h.dan = 45.0; h.radio = 2.6; }), h_carrera(12.5, |h| h.gasto = 14.0), h("salto", 25.0, 2.0, |h| h.alto = 9.0)]),
        d("vegeta", "Vegeta", "Vegeta", 250.0, 7.5, 2.4, a, "accion", false, [h_golpe(30.0, |h| { h.cd = 0.45; h.imp = 0.2; }), h("rafaga", 25.0, 1.2, |h| { h.dan = 48.0; h.radio = 2.6; }), h_carrera(12.5, |h| h.gasto = 14.0), h("salto", 25.0, 2.0, |h| h.alto = 9.0)]),
        d("broly", "Broly", "Broly", 420.0, 6.8, 2.0, Some(3.9), "accion", false, [h_golpe(42.0, |h| { h.cd = 0.7; h.alc = 2.2; }), h("rafaga", 35.0, 2.0, |h| { h.dan = 70.0; h.radio = 4.0; }), h_carrera(10.5, |_| {}), h("embestida", 30.0, 4.0, |h| { h.dan = 50.0; h.vel = 17.0; h.son = "GG_Launch3".into(); })]),
        d("gohan", "Gohan", "Gohan", 230.0, 7.3, 2.3, a, "accion", false, [h_golpe(26.0, |h| { h.cd = 0.45; h.imp = 0.2; }), h("rafaga", 25.0, 1.2, |h| { h.dan = 44.0; h.radio = 2.6; }), h_carrera(12.0, |h| h.gasto = 14.0), h("salto", 25.0, 2.0, |h| h.alto = 9.0)]),
        d("piccolo", "Piccolo", "Piccolo", 260.0, 7.0, 2.2, a, "accion", false, [h_golpe(28.0, |h| h.cd = 0.5), h("rafaga", 25.0, 1.4, |h| { h.dan = 46.0; h.radio = 2.6; }), h_carrera(11.0, |_| {}), h("curar", 50.0, 16.0, |h| { h.cura = 60.0; h.son = "GG_Pickup".into(); })]),
        d("ninja", "Ninja", "Ninja", 170.0, 8.0, 2.0, a, "accion", false, [h_golpe(24.0, |h| { h.cd = 0.4; h.imp = 0.18; }), h("embestida", 25.0, 3.0, |h| { h.dan = 34.0; h.vel = 18.0; h.son = "Arm_Swing_edited".into(); }), h_carrera(12.8, |h| h.gasto = 12.0), h("salto", 20.0, 1.6, |h| h.alto = 7.0)]),
        d("robot", "Robot", "Robot", 340.0, 6.2, 0.9, Some(3.6), "accion", true, [h_golpe(32.0, |h| h.cd = 0.8), h("rafaga", 25.0, 1.6, |h| { h.dan = 40.0; h.radio = 2.2; h.laser = true; }), h_carrera(9.8, |_| {}), h("curar", 50.0, 16.0, |h| { h.cura = 80.0; h.son = "UI_interruptor".into(); })]),
        d("v1", "V1", "V1", 180.0, 8.0, 2.0, a, "accion", true, [h_golpe(28.0, |h| { h.cd = 0.4; h.imp = 0.18; }), h("rafaga", 20.0, 0.9, |h| { h.dan = 34.0; h.radio = 2.0; h.laser = true; }), h_carrera(13.2, |h| h.gasto = 12.0), h("embestida", 20.0, 2.0, |h| { h.dan = 30.0; h.vel = 20.0; h.son = "GG_Launch1".into(); })]),
        d("jake", "Jake", "Jake", 150.0, 6.5, 1.6, None, "mas", false, [h_golpe(18.0, |h| h.alc = 1.2), h_susto(|h| { h.son = "VZ_h_hola1".into(); h.costo = 20.0; h.radio = 6.0; }), h_carrera(10.4, |_| {}), h("salto", 20.0, 1.6, |h| h.alto = 6.0)]),
        d("finn", "Finn", "Finn", 160.0, 7.0, 1.5, None, "mas", false, [h_golpe(24.0, |h| { h.cd = 0.5; h.imp = 0.18; }), h_susto(|h| { h.son = "VZ_h_hola2".into(); h.costo = 20.0; h.radio = 6.0; }), h_carrera(11.2, |_| {}), h("salto", 20.0, 1.6, |h| h.alto = 6.0)]),
        d("astronauta", "Astronauta", "Astronauta", 200.0, 6.2, 2.6, None, "mas", false, [h_golpe(20.0, |_| {}), None, h_carrera(9.4, |_| {}), h("salto", 20.0, 1.5, |h| h.alto = 10.0)]),
        d("pirata", "Pirata", "Pirata", 200.0, 6.6, 1.1, None, "mas", false, [h_golpe(28.0, |h| { h.cd = 0.55; h.imp = 0.18; }), h_susto(|h| { h.son = "VZ_h_no1".into(); h.costo = 20.0; h.radio = 7.0; }), h_carrera(10.0, |_| {}), h("embestida", 25.0, 4.0, |h| { h.dan = 30.0; h.vel = 14.0; h.son = "Arm_Swing_edited".into(); })]),
        d("rick", "Rick", "Rick", 180.0, 6.6, 1.1, None, "mas", false, [h_golpe(18.0, |_| {}), h("rafaga", 25.0, 1.4, |h| { h.dan = 36.0; h.radio = 2.2; h.laser = true; }), h_carrera(9.9, |_| {}), h("tele", 35.0, 5.0, |h| { h.alc = 20.0; h.son = "GG_Launch4".into(); })]),
    ]
}
/// pillGmDef: un personaje de un Pill Pack del Workshop como Pill del juego
pub fn de_gm(p: &PillGm) -> DefPill {
    const GS: f32 = 0.0254;
    let (walk, run) = (p.walk as f32, p.run as f32);
    // (la velocidad respecto del jugador de GMod —camina a 200 unidades/s, el de acá a 6 m/s—; todos tienen carrera: la del
    // pack si corre más de lo que camina —como mínimo ×1,5—, siempre por encima de 9 m/s)
    let vel = (walk * VEL_JUG / 200.0).clamp(VEL_JUG, 15.0);
    let mult = (if run > walk * 1.1 { run / walk } else { 1.5 }).max(1.5).max(9.0 / vel).clamp(1.5, (18.0 / vel).max(1.5));
    let at = |k: usize, f: &PillGm| -> Option<Hab> {
        match f.ataques[k].as_ref()? {
            AtaquePill::Golpe { dmg, range, delay, .. } => Some(Hab { t: "golpe", dan: (*dmg as f32).clamp(1.0, 100000.0), alc: (*range as f32 * GS + 0.9).clamp(1.3, 4.5), cd: (*delay as f32).clamp(0.1, 1.5) + 0.3, imp: (*delay as f32).clamp(0.1, 1.5), s_gm: f.s_golpe.clone(), s_pega: f.s_pega.clone(), s_falla: f.s_falla.clone(), ..Default::default() }),
            AtaquePill::Disparo { dmg, num, spread, delay } => Some(Hab { t: "disparo", dan: (*dmg as f32).clamp(1.0, 100000.0), num: (*num as u32).clamp(1, 12), disp: (*spread as f32).clamp(0.0, 0.5), cd: (*delay as f32).clamp(0.05, 10.0), s_gm: f.s_disparo.clone(), ..Default::default() }),
            AtaquePill::Lua { delay } => Some(Hab { t: "lua", cd: (*delay as f32).clamp(0.1, 10.0), lua: Some(k), ..Default::default() }),
        }
    };
    let jp = p.salto as f32;
    DefPill { id: format!("gm:{}", p.nombre), nom: p.impreso.clone(), skin: format!("gmpm:{}", p.modelo), vida: (p.vida as f32).round().clamp(1.0, 999999.0), vel,
        salto: if jp > 0.0 { (1.1 * jp / 200.0).clamp(0.3, 12.0) } else { 0.0 }, cam: Some((p.cam as f32 * GS + 1.2).clamp(2.2, 9.0)), cat: format!("gm:{}", p.pack), metal: false,
        hab: [at(0, p), at(1, p), Some(Hab { t: "carrera", mult, gasto: 14.0, ..Default::default() }), at(2, p)], pasos: p.pasos.clone(), gm: Some(p.nombre.clone()) }
}

/// lo de antes de transformarse (la velocidad, el salto, la vida, la cámara, el arma y el cuerpo)
#[derive(Clone, Debug)]
struct Guardado { vel_max: f32, salto: f32, vida: f32, camara: u8, arma: usize, skin: String }
/// el Pill puesto
#[derive(Default)]
pub struct Pill {
    pub def: Option<DefPill>, pub pod: f32, cd: [f32; 4], ant: [bool; 4], pub carrera: bool, golpe: Option<(f32, Hab)>, emb: Option<(f32, Hab, Vec<u32>, Vec<u32>)>,
    guard: Option<Guardado>, sin_regen: f32, raiz_t: f32, paso_d: f32, vida_max: f32, ver3: Option<bool>,
    /// los NPC asustados o bailando: (id, la actitud de antes, cuánto falta)
    npc_mod: Vec<(u32, npc::Actitud, f32)>,
    /// los de los Pill Packs del Workshop (se leen cuando se arma el menú)
    pub gm: Vec<DefPill>,
}
impl Pill { pub fn on(&self) -> bool { self.def.is_some() } }

impl Juego {
    pub fn pill_on(&self) -> bool { self.gmod.pill.on() }
    /// un Pill por id (los propios y los de los addons: «gm:<nombre>»)
    fn pill_def(&self, id: &str) -> Option<DefPill> { if id.starts_with("gm:") { self.gmod.pill.gm.iter().find(|d| d.id == id).cloned() } else { propios().into_iter().find(|d| d.id == id) } }
    /// los de los Pill Packs del Workshop instalados
    pub(crate) fn pill_leer_gm(&mut self) { self.gmod.pill.gm = self.gmod.gm.as_mut().map(|g| g.pills()).unwrap_or_default().iter().map(de_gm).collect(); }
    /// pillAplicar: pasar a ser ese personaje
    pub fn pill_aplicar(&mut self, m: &mut Motor3d, id: &str) -> bool {
        let Some(d) = self.pill_def(id) else { return false };
        if self.mapa.is_none() { return false; }
        if self.muerto || self.jug.vida <= 0.0 { self.avisar("Muerto no te podés transformar".into()); return false; }
        if self.vehs.jugador.is_some() { self.avisar("Bajate del vehículo para transformarte".into()); return false; }
        if self.gmod.pill.def.as_ref().map(|x| x.id == d.id).unwrap_or(false) { self.avisar(format!("Ya sos {}", d.nom)); return true; }
        if self.gmod.pill.guard.is_none() { self.gmod.pill.guard = Some(Guardado { vel_max: self.jug.vel_max, salto: self.jug.salto, vida: self.jug.vida, camara: self.camara, arma: self.armas.i, skin: self.skin.clone() }); }
        let p = &mut self.gmod.pill; p.cd = [0.0; 4]; p.ant = [true; 4]; p.carrera = false; p.golpe = None; p.emb = None; p.sin_regen = 0.0; p.raiz_t = 0.0; p.paso_d = 0.0; p.pod = 100.0; p.vida_max = d.vida;
        // (sin armas: las manos; la cámara en tercera persona —la que tenía la última vez, si cambió—)
        if let Some(i) = ARMAS.iter().position(|a| a.n == "Hands") { self.gmod_guardar_arma(); self.armas.elegir(&mut self.fis, i); }
        self.camara = if self.gmod.pill.ver3.unwrap_or(true) { 1 } else { 0 }; self.jug.noclip = false;
        if let Some(n) = &d.gm { if let Some(g) = self.gmod.gm.as_mut() { g.pill_activo(Some(n.clone())); } }
        let (nom, skin) = (d.nom.clone(), d.skin.clone());
        self.gmod.pill.def = Some(d); self.jug.vida = self.gmod.pill.vida_max;
        self.gmp_elegir(m, &skin); self.pill_stats();
        self.pill_puf(); self.avisar(format!("Ahora sos {nom}"));
        true
    }
    /// pillFin: volver al personaje de siempre (la velocidad, el salto, la vida, la cámara, el arma y el cuerpo de antes)
    pub fn pill_fin(&mut self, m: &mut Motor3d) {
        let Some(_) = self.gmod.pill.def.take() else { return };
        if let Some(g) = self.gmod.gm.as_mut() { g.pill_activo(None); }
        let gd = self.gmod.pill.guard.take();
        self.gmod.pill.ver3 = Some(self.camara != 0);
        for (id, a, _) in std::mem::take(&mut self.gmod.pill.npc_mod) { self.npcs.aplicar(id, a); }
        if let Some(gd) = gd {
            self.jug.vel_max = gd.vel_max; self.jug.salto = gd.salto; self.camara = gd.camara;
            if !self.muerto { self.jug.vida = gd.vida.min(100.0).max(1.0).min(self.jug.vida.max(gd.vida.min(100.0))); }
            self.armas.elegir(&mut self.fis, gd.arma);
            let s = gd.skin.clone(); self.gmp_elegir(m, &s);
        }
        self.pill_puf(); self.avisar("Volviste a tu personaje".into());
    }
    /// pillStats: la velocidad (con la carrera) y el salto del personaje
    fn pill_stats(&mut self) {
        let Some(d) = &self.gmod.pill.def else { return };
        let h2 = if self.gmod.pill.carrera { d.hab[2].as_ref().map(|h| h.mult) } else { None };
        let correr = self.dedos.iter().any(|x| x.palanca && ((x.x - x.x0).powi(2) + (x.y - x.y0).powi(2)).sqrt() > self.gmod.pantalla.1 * 0.12 * 1.6);
        self.jug.vel_max = if self.gmod.pill.raiz_t > 0.0 { 0.0 } else { d.vel * h2.map(|m| m / if correr { 1.35 } else { 1.0 }).unwrap_or(1.0) };
        self.jug.salto = if d.salto > 0.0 { d.salto } else { (1.1 - 0.35 * (self.jug.tam - 1.0)).clamp(0.8, 1.25) };
    }
    /// la nube y el sonido al transformarse (pillPuf)
    fn pill_puf(&mut self) {
        let p = self.jug.pos;
        for k in 0..18 { let a = k as f32 * 0.35; if let Some(x) = self.ef.particula([p[0] + a.sin() * 0.5, p[1] - 0.4 + (k % 5) as f32 * 0.3, p[2] + a.cos() * 0.5], [a.sin() * 1.5, 0.8, a.cos() * 1.5], 0.7, 0.35, [0.9, 0.9, 0.95, 0.6], efx::Tipo::Humo, 0.6) { let _ = x; } }
        self.sonido.tocar("GG_Pickup", 0.6, 1.2, None);
    }
    /// cada cuadro (pillPaso): las esperas, lo que se aprieta, el poder que vuelve, la velocidad, el golpe que llega y la embestida
    pub(crate) fn pill_paso(&mut self, m: &mut Motor3d, dt: f32) {
        // (lo que pidió el Lua de un Pill Pack: ponerse uno o volver)
        if let Some(p) = self.gmod.gm.as_mut().and_then(|g| g.pill_pedido()) { match p { Some(n) => { if self.gmod.pill.gm.is_empty() { self.pill_leer_gm(); } self.pill_aplicar(m, &format!("gm:{n}")); } None => self.pill_fin(m) } }
        // (los NPC asustados o bailando vuelven a lo suyo)
        let mut volver = vec![]; for x in self.gmod.pill.npc_mod.iter_mut() { x.2 -= dt; if x.2 <= 0.0 { volver.push((x.0, x.1.clone())); } }
        self.gmod.pill.npc_mod.retain(|x| x.2 > 0.0); for (id, a) in volver { self.npcs.aplicar(id, a); }
        let Some(d) = self.gmod.pill.def.clone() else { return };
        if self.muerto || self.jug.vida <= 0.0 { let gd = self.gmod.pill.guard.take(); self.gmod.pill.def = None; if let Some(g) = gd { self.jug.vel_max = g.vel_max; self.jug.salto = g.salto; } return; }
        for c in self.gmod.pill.cd.iter_mut() { *c = (*c - dt).max(0.0); }
        if self.gmod.pill.raiz_t > 0.0 { self.gmod.pill.raiz_t -= dt; self.jug.vel[0] = 0.0; self.jug.vel[2] = 0.0; }
        let libre = !self.gmod.panel && self.menu.is_none() && self.ajustes.is_none() && self.vehs.jugador.is_none();
        let correr = self.dedos.iter().any(|x| x.palanca && ((x.x - x.x0).powi(2) + (x.y - x.y0).powi(2)).sqrt() > self.gmod.pantalla.1 * 0.12 * 1.6);
        let ap = [libre && self.apretado(Boton::Disparo), libre && self.apretado(Boton::Disparo2), libre && (correr || self.apretado(Boton::Turbo)), libre && self.apretado(Boton::Recargar)];
        for i in 0..4 {
            let Some(hb) = d.hab[i].clone() else { self.gmod.pill.ant[i] = ap[i]; continue };
            if hb.t == "carrera" { self.pill_carrera(&hb, ap[i], dt); }
            else if ap[i] && (!self.gmod.pill.ant[i] || hb.t == "golpe" || hb.t == "disparo") { self.pill_usar(m, i, &hb); }
            self.gmod.pill.ant[i] = ap[i];
        }
        let p = &mut self.gmod.pill;
        if p.sin_regen > 0.0 { p.sin_regen -= dt; } else if !p.carrera { p.pod = (p.pod + 9.0 * dt).min(100.0); }
        self.pill_stats();
        if let Some((t, hb)) = self.gmod.pill.golpe.take() { if t - dt <= 0.0 { self.pill_golpe_aplicar(&hb); } else { self.gmod.pill.golpe = Some((t - dt, hb)); } }
        if let Some((t, hb, ya_n, ya_o)) = self.gmod.pill.emb.take() { let (ya_n, ya_o) = self.pill_embestida_paso(&hb, ya_n, ya_o); if t - dt > 0.0 { self.gmod.pill.emb = Some((t - dt, hb, ya_n, ya_o)); } }
        // (los pasos de metal de los animatrónicos)
        let sp = (self.jug.vel[0].powi(2) + self.jug.vel[2].powi(2)).sqrt();
        if !d.pasos.is_empty() && self.jug.suelo && sp > 0.5 { self.gmod.pill.paso_d += sp * dt; let l = 1.0 + 0.12 * (sp - 2.0).max(0.0); if self.gmod.pill.paso_d >= l { self.gmod.pill.paso_d -= l; let k = (self.t0.elapsed().as_millis() as usize) % d.pasos.len(); let s = d.pasos[k].clone(); self.pill_sonar(&s, None, (sp / 9.0).clamp(0.18, 0.45)); } }
    }
    /// un sonido del juego o, si no está, del addon del Pill
    fn pill_sonar(&mut self, s: &str, p: Option<[f32; 3]>, vol: f32) {
        if s.is_empty() { return; }
        if s.contains('/') || s.contains('.') { let c = self.gm_snd_registrar(s); self.sonido.tocar(&c, vol, 1.0, p); } else { self.sonido.tocar(s, vol, 1.0, p); }
    }
    fn pill_carrera(&mut self, hb: &Hab, ap: bool, dt: f32) {
        let mueve = self.jug.suelo && (self.jug.vel[0].abs() + self.jug.vel[2].abs() > 0.1);
        let p = &mut self.gmod.pill; let si = ap && p.pod > 0.5 && (mueve || p.carrera);
        if si && !p.carrera { if p.pod < 8.0 { p.ant[2] = true; return; } if !hb.son.is_empty() { let s = hb.son.clone(); self.pill_sonar(&s, None, 0.65); } }
        let p = &mut self.gmod.pill; p.carrera = si;
        if si && mueve { p.pod = (p.pod - hb.gasto * dt).max(0.0); p.sin_regen = 0.6; }
        if p.pod <= 0.5 { p.carrera = false; }
    }
    /// una habilidad de un toque (pillUsar): si hay poder y ya pasó la espera
    fn pill_usar(&mut self, m: &mut Motor3d, i: usize, hb: &Hab) {
        if self.gmod.pill.cd[i] > 0.0 { return; }
        if self.gmod.pill.pod + 1e-6 < hb.costo { if !self.gmod.pill.ant[i] { self.avisar("Sin poder".into()); } return; }
        let ok = match hb.t {
            "golpe" => { self.pill_golpe(hb); true }
            "susto" => self.pill_susto(hb), "cajita" => self.pill_cajita(hb), "tele" => self.pill_tele(hb), "curar" => self.pill_curar(hb),
            "embestida" => { self.pill_embestida(hb); true } "salto" => self.pill_salto(hb), "rafaga" => self.pill_rafaga(hb), "disparo" => { self.pill_disparo(hb); true }
            "lua" => { let n = self.gmod.pill.def.as_ref().and_then(|d| d.gm.clone()); match (n, hb.lua) { (Some(n), Some(k)) => { self.gmod_prestar(true); let r = self.gmod.gm.as_mut().map(|g| g.pill_ataque(&n, k)).unwrap_or(false); self.gmod_prestar(false); r } _ => false } }
            _ => false,
        };
        let _ = m;
        if !ok { return; }
        let p = &mut self.gmod.pill; p.pod -= hb.costo; if hb.costo > 0.0 { p.sin_regen = 0.8; } p.cd[i] = if hb.cd > 0.0 { hb.cd } else { 0.5 };
    }
    fn pill_adelante(&self) -> [f32; 3] { [self.jug.yaw.sin(), 0.0, self.jug.yaw.cos()] }
    /// el golpe: el gesto y el sonido ya; pega `imp` segundos después (pillGolpe)
    fn pill_golpe(&mut self, hb: &Hab) {
        if let Some(pj) = self.pj.as_mut() { pj.accion(personaje::Gesto::Tiro); }
        match hb.s_gm.first().cloned() { Some(_) => { let k = (self.t0.elapsed().as_millis() as usize) % hb.s_gm.len(); let s = hb.s_gm[k].clone(); self.pill_sonar(&s, None, 0.8); } None => { let metal = self.gmod.pill.def.as_ref().map(|d| d.metal).unwrap_or(false); self.sonido.tocar("CB_Swing", 0.5, if metal { 0.83 } else { 0.95 }, None); } }
        self.gmod.pill.golpe = Some((hb.imp.max(0.0), hb.clone()));
    }
    /// pillGolpeAplicar: lo que hay adelante al alcance (NPC, muñecos y objetos) recibe el golpe
    fn pill_golpe_aplicar(&mut self, hb: &Hab) {
        if self.muerto { return; }
        let f = self.pill_adelante(); let tk = self.pj.as_ref().map(|p| p.tam).unwrap_or(1.0); let jp = self.jug.pos;
        let c = [jp[0] + f[0] * 0.85 * tk, jp[1] - 0.95 + 1.05 * tk, jp[2] + f[2] * 0.85 * tk]; let r = hb.alc * tk.clamp(0.8, 1.3); let dan = hb.dan.round();
        let mut pego: Option<([f32; 3], bool)> = None;
        let cerca: Vec<(u32, [f32; 3], bool, f32)> = self.npcs.lista.iter().map(|q| { let p = q.pos(); (q.id, [p[0], p[1] - 0.95 + 0.9 * q.tam as f32, p[2]], q.rag.is_some(), q.tam as f32) }).collect();
        for (id, q, rag, qt) in cerca {
            let d = [q[0] - jp[0], 0.0, q[2] - jp[2]]; let dist = ((q[0] - c[0]).powi(2) + (q[1] - c[1]).powi(2) + (q[2] - c[2]).powi(2)).sqrt();
            if dist > r + 0.4 * qt || d[0] * f[0] + d[2] * f[2] < -0.2 || (q[1] - c[1]).abs() > 1.6 * tk.max(1.0) { continue; }
            if rag { self.npcs.tumbar(id, [f[0] * 7.0, 2.5, f[2] * 7.0], &mut self.fis); pego = pego.or(Some((q, true))); continue; }
            self.npcs.danar(id, dan, q, f, &mut self.fis, Some(npc::Quien::Jugador));
            if dan >= 30.0 && self.npcs.get(id).map(|n| n.vivo && n.rag.is_none()).unwrap_or(false) { self.npcs.tumbar(id, [f[0] * 6.0, 2.5, f[2] * 6.0], &mut self.fis); }
            pego = Some((q, true));
        }
        let objs: Vec<(usize, u32, [f32; 3])> = self.objs.iter().enumerate().filter_map(|(i, o)| o.cuerpo.map(|b| (i, b, o.pos))).collect();
        for (i, b, p) in objs {
            let Some(cb) = self.fis.cuerpo(b) else { continue }; if cb.congelado || cb.sin_fisica { continue; }
            let (masa, rr) = (cb.masa as f32, 0.5f32);
            if ((p[0] - c[0]).powi(2) + (p[1] - c[1]).powi(2) + (p[2] - c[2]).powi(2)).sqrt() > r + rr { continue; }
            if (p[0] - jp[0]) * f[0] + (p[2] - jp[2]) * f[2] < 0.0 { continue; }
            let dv = (900.0 / masa.max(1.0)).min(11.0) as f64;
            if let Some(cb) = self.fis.cuerpo_mut(b) { cb.despertar(); cb.vel[0] += f[0] as f64 * dv; cb.vel[2] += f[2] as f64 * dv; cb.vel[1] += dv * 0.3; }
            self.danar_objeto(i, dan); pego = pego.or(Some((p, false)));
        }
        if let Some((p, carne)) = pego {
            self.sonido.tocar(if carne { "CB_Flesh1" } else { "CB_Impact1" }, 0.9, 1.0, Some(p));
            self.ef.impacto(p, [-f[0], -f[1], -f[2]], if carne { efx::Sup::Cuerpo } else { efx::Sup::Golpe }); self.temblor = self.temblor.max(0.14);
        }
        let l = if pego.is_some() { &hb.s_pega } else { &hb.s_falla }; if let Some(s) = l.first().cloned() { self.pill_sonar(&s, pego.map(|x| x.0), 0.8); }
    }
    /// un NPC con otra actitud un rato (asustado o bailando: pillNpcCambiar)
    fn pill_npc_cambiar(&mut self, id: u32, a: npc::Actitud, seg: f32) {
        let Some(q) = self.npcs.get(id) else { return };
        let antes = match self.gmod.pill.npc_mod.iter().position(|x| x.0 == id) { Some(i) => self.gmod.pill.npc_mod.remove(i).1, None => q.act.clone() };
        self.npcs.aplicar(id, a); self.gmod.pill.npc_mod.push((id, antes, seg));
    }
    /// el susto: el grito y la pose de susto; los NPC de cerca huyen (pillSusto)
    fn pill_susto(&mut self, hb: &Hab) -> bool {
        self.jug.vel[0] = 0.0; self.jug.vel[2] = 0.0; self.gmod.pill.raiz_t = 1.1;
        self.hacer_emote(Some("Scream".into()));
        let s = hb.son.clone(); self.pill_sonar(&s, None, 0.85); self.temblor = self.temblor.max(0.2);
        let jp = self.jug.pos;
        let ids: Vec<u32> = self.npcs.lista.iter().filter(|q| q.vivo && q.rag.is_none() && { let p = q.pos(); ((p[0] - jp[0]).powi(2) + (p[1] - jp[1]).powi(2) + (p[2] - jp[2]).powi(2)).sqrt() <= hb.radio }).map(|q| q.id).collect();
        for id in ids { self.pill_npc_cambiar(id, npc::Actitud { modo: npc::Modo::Huir, dist: (hb.radio + 8.0) as f64, vel: 6.5, hostil: false, obj: npc::Obj::Yo, ..Default::default() }, 7.0); }
        true
    }
    /// la cajita musical: los NPC de cerca bailan mientras suena (pillCajita)
    fn pill_cajita(&mut self, hb: &Hab) -> bool {
        let jp = self.jug.pos; let s = hb.son.clone(); self.pill_sonar(&s, Some(jp), 1.0);
        let ids: Vec<u32> = self.npcs.lista.iter().filter(|q| q.vivo && q.rag.is_none() && { let p = q.pos(); ((p[0] - jp[0]).powi(2) + (p[1] - jp[1]).powi(2) + (p[2] - jp[2]).powi(2)).sqrt() <= hb.radio }).map(|q| q.id).collect();
        for id in ids { self.pill_npc_cambiar(id, npc::Actitud { modo: npc::Modo::Bailar, emote: "ChickenDance".into(), hostil: false, ..Default::default() }, hb.dur); }
        for k in 0..10 { let a = k as f32; let _ = self.ef.particula([jp[0] + (a * 1.3).sin() * 0.5, jp[1] + 0.6 + (k % 3) as f32 * 0.3, jp[2] + (a * 1.3).cos() * 0.5], [0.0, 0.8, 0.0], 2.0, 0.07, [1.0, 0.9, 0.5, 1.0], efx::Tipo::Chispa, 0.3); }
        true
    }
    /// aparecer donde se mira, hasta `alc` metros, en el piso (pillTele)
    fn pill_tele(&mut self, hb: &Hab) -> bool {
        let (o, d) = (self.ojos_ult, self.mira()); let Some(mp) = self.mapa.as_ref() else { return false };
        let hit = self.fis.rayo(&mp.mundo, [o[0] as f64, o[1] as f64, o[2] as f64], [d[0] as f64, d[1] as f64, d[2] as f64], hb.alc as f64, &[]);
        let mut p = match &hit { Some(h) => { let t = (h.t as f32 - 0.7).max(0.0); [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t] } None => [o[0] + d[0] * hb.alc, o[1] + d[1] * hb.alc, o[2] + d[2] * hb.alc] };
        if let Some(h) = &hit { p[0] += h.n[0] as f32 * 0.35; p[2] += h.n[2] as f32 * 0.35; }
        let Some(g) = mp.mundo.rayo([p[0], p[1] + 0.6, p[2]], [0.0, -1.0, 0.0], 40.0) else { self.avisar("No hay piso ahí".into()); return false };
        if g.n[1] < 0.5 { self.avisar("No hay piso ahí".into()); return false; }
        let dest = [p[0], p[1] + 0.6 - g.t + self.jug.medio + self.jug.radio + 0.02, p[2]];
        let desde = self.jug.pos; if ((dest[0] - desde[0]).powi(2) + (dest[1] - desde[1]).powi(2) + (dest[2] - desde[2]).powi(2)).sqrt() < 1.5 { return false; }
        self.pill_estatica(desde); self.jug.pos = dest; self.jug.vel = [0.0; 3]; self.pill_estatica(dest);
        let s = hb.son.clone(); self.pill_sonar(&s, None, 0.8); true
    }
    fn pill_estatica(&mut self, p: [f32; 3]) { for k in 0..22 { let a = k as f32 * 2.4; let _ = self.ef.particula([p[0] + a.sin() * 0.45, p[1] - 0.95 + (k % 7) as f32 * 0.3, p[2] + a.cos() * 0.45], [0.0, 0.3, 0.0], 0.4, 0.05, [0.9, 0.9, 1.0, 1.0], efx::Tipo::Chispa, 0.0); } }
    fn pill_curar(&mut self, hb: &Hab) -> bool {
        let vm = self.gmod.pill.vida_max; if self.jug.vida >= vm - 0.5 { self.avisar("Ya tenés toda la vida".into()); return false; }
        self.jug.vida = (self.jug.vida + hb.cura.round()).min(vm); let s = hb.son.clone(); self.pill_sonar(&s, None, 0.7);
        let p = self.jug.pos; for k in 0..16 { let a = k as f32; let _ = self.ef.particula([p[0] + (a * 1.7).sin() * 0.45, p[1] - 0.5 + (k % 5) as f32 * 0.3, p[2] + (a * 1.7).cos() * 0.45], [0.0, 1.2, 0.0], 0.8, 0.05, [1.0, 0.55, 0.3, 1.0], efx::Tipo::Chispa, 0.0); }
        true
    }
    /// salir disparado hacia adelante y lastimar a lo que choca (pillEmbestida)
    fn pill_embestida(&mut self, hb: &Hab) {
        let f = self.pill_adelante(); self.jug.vel[0] = f[0] * hb.vel; self.jug.vel[2] = f[2] * hb.vel; self.jug.vel[1] = self.jug.vel[1].max(2.2); self.jug.suelo = false;
        if let Some(pj) = self.pj.as_mut() { pj.accion(personaje::Gesto::Tiro); }
        let s = hb.son.clone(); self.pill_sonar(&s, None, 0.75);
        self.gmod.pill.emb = Some((0.55, hb.clone(), vec![], vec![]));
    }
    fn pill_embestida_paso(&mut self, hb: &Hab, mut ya_n: Vec<u32>, mut ya_o: Vec<u32>) -> (Vec<u32>, Vec<u32>) {
        let v = self.jug.vel; let l = (v[0] * v[0] + v[2] * v[2]).sqrt(); if l < 2.0 { return (ya_n, ya_o); }
        let f = [v[0] / l, 0.0, v[2] / l]; let tk = self.pj.as_ref().map(|p| p.tam).unwrap_or(1.0); let r = tk + 0.35; let jp = self.jug.pos; let dan = hb.dan.round();
        let cerca: Vec<(u32, [f32; 3], bool, f32)> = self.npcs.lista.iter().map(|q| (q.id, q.pos(), q.rag.is_some(), q.tam as f32)).collect();
        for (id, q, rag, qt) in cerca {
            if ya_n.contains(&id) || ((q[0] - jp[0]).powi(2) + (q[2] - jp[2]).powi(2)).sqrt() > r + 0.4 * qt || (q[1] - jp[1]).abs() > 1.6 { continue; }
            ya_n.push(id);
            if rag { self.npcs.tumbar(id, [f[0] * 9.0, 3.0, f[2] * 9.0], &mut self.fis); continue; }
            self.npcs.danar(id, dan, q, f, &mut self.fis, Some(npc::Quien::Jugador));
            if self.npcs.get(id).map(|n| n.vivo && n.rag.is_none()).unwrap_or(false) { self.npcs.tumbar(id, [f[0] * 9.0, 3.5, f[2] * 9.0], &mut self.fis); }
            self.sonido.tocar("CB_Flesh2", 0.9, 1.0, Some(q)); self.ef.impacto(q, [-f[0], 0.0, -f[2]], efx::Sup::Cuerpo); self.temblor = self.temblor.max(0.2);
        }
        let objs: Vec<(usize, u32, [f32; 3])> = self.objs.iter().enumerate().filter_map(|(i, o)| o.cuerpo.map(|b| (i, b, o.pos))).collect();
        for (i, b, p) in objs {
            if ya_o.contains(&b) { continue; } let Some(cb) = self.fis.cuerpo(b) else { continue }; if cb.congelado || cb.sin_fisica { continue; }
            if ((p[0] - jp[0]).powi(2) + (p[1] - jp[1]).powi(2) + (p[2] - jp[2]).powi(2)).sqrt() > r + 0.5 { continue; }
            ya_o.push(b); let dv = (1200.0 / (cb.masa as f32).max(1.0)).min(14.0) as f64;
            if let Some(cb) = self.fis.cuerpo_mut(b) { cb.despertar(); cb.vel[0] += f[0] as f64 * dv; cb.vel[2] += f[2] as f64 * dv; cb.vel[1] += dv * 0.35; }
            self.danar_objeto(i, dan);
        }
        (ya_n, ya_o)
    }
    /// un salto alto (pillSalto)
    fn pill_salto(&mut self, hb: &Hab) -> bool {
        if !self.jug.suelo && self.jug.aire > 0.15 { return false; }
        let g = 9.81f32; self.jug.vel[1] = (2.0 * g * hb.alto).sqrt(); self.jug.suelo = false;
        let f = self.pill_adelante(); let sp = self.jug.vel[0] * f[0] + self.jug.vel[2] * f[2]; if sp > 1.0 { self.jug.vel[0] += f[0] * 2.0; self.jug.vel[2] += f[2] * 2.0; }
        self.sonido.tocar("Arm_Swing_edited", 0.6, 0.7, None);
        let p = self.jug.pos; for k in 0..10 { let a = k as f32 * 0.63; let _ = self.ef.particula([p[0] + a.sin() * 0.4, p[1] - 0.9, p[2] + a.cos() * 0.4], [a.sin() * 2.0, 0.5, a.cos() * 2.0], 0.6, 0.25, [0.85, 0.85, 0.8, 0.5], efx::Tipo::Humo, 0.0); }
        true
    }
    /// la ráfaga de ki (o el láser): hasta lo que apunta y una explosión chica ahí (pillRafaga)
    fn pill_rafaga(&mut self, hb: &Hab) -> bool {
        let (o, d) = (self.ojos_ult, self.mira()); let Some(mp) = self.mapa.as_ref() else { return false };
        let a = [o[0] + d[0] * 0.7, o[1] + d[1] * 0.7, o[2] + d[2] * 0.7];
        let hit = self.fis.rayo(&mp.mundo, [a[0] as f64, a[1] as f64, a[2] as f64], [d[0] as f64, d[1] as f64, d[2] as f64], 90.0, &[]);
        let t = hit.as_ref().map(|h| h.t as f32).unwrap_or(90.0); let q = [a[0] + d[0] * t, a[1] + d[1] * t, a[2] + d[2] * t];
        let mano = self.pj.as_ref().and_then(|p| p.hueso("RightHand")).map(|w| { let b = personaje::base([self.jug.pos[0], self.jug.pos[1] - 0.95, self.jug.pos[2]], self.jug.yaw); let w = m4::mul(&b, &w); [w[12], w[13], w[14]] }).unwrap_or([self.jug.pos[0], self.jug.pos[1] + 0.45, self.jug.pos[2]]);
        if let Some(pj) = self.pj.as_mut() { pj.accion(personaje::Gesto::Tiro); }
        self.ef.traza(mano, q); self.sonido.tocar(if hb.laser { "TG_Fire1" } else { "GG_Launch2" }, 0.7, if hb.laser { 0.8 } else { 1.1 }, None);
        let jp = self.jug.pos;
        if hit.is_some() && ((q[0] - jp[0]).powi(2) + (q[1] - jp[1]).powi(2) + (q[2] - jp[2]).powi(2)).sqrt() > hb.radio * 1.45 { self.explosion(q, hb.radio, hb.dan); }
        else if let Some(h) = hit { self.ef.impacto(q, [h.n[0] as f32, h.n[1] as f32, h.n[2] as f32], efx::Sup::Mundo); }
        true
    }
    /// el disparo de un Pill Pack (pk_pills.common.shoot: pillDisparo)
    fn pill_disparo(&mut self, hb: &Hab) {
        let (o, d0) = (self.ojos_ult, self.mira()); let n = hb.num.clamp(1, 12);
        for k in 0..n {
            let s = hb.disp; let r = |i: u32| { let x = ((k * 7919 + i * 104729 + self.t0.elapsed().subsec_nanos()) % 1000) as f32 / 1000.0; x - 0.5 };
            let d = { let v = [d0[0] + r(1) * s, d0[1] + r(2) * s, d0[2] + r(3) * s]; let l = (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]).sqrt().max(1e-6); [v[0] / l, v[1] / l, v[2] / l] };
            let Some(mp) = self.mapa.as_ref() else { return };
            let a = [o[0] + d[0] * 0.6, o[1] + d[1] * 0.6, o[2] + d[2] * 0.6];
            let hit = self.fis.rayo(&mp.mundo, [a[0] as f64, a[1] as f64, a[2] as f64], [d[0] as f64, d[1] as f64, d[2] as f64], 300.0, &[]);
            let t = hit.as_ref().map(|h| h.t as f32).unwrap_or(300.0); let q = [a[0] + d[0] * t, a[1] + d[1] * t, a[2] + d[2] * t];
            self.ef.traza([o[0], o[1] - 0.2, o[2]], q);
            let Some(h) = hit else { continue };
            match h.cuerpo.and_then(|c| self.npcs.de_cuerpo(c)) {
                Some(id) => { self.npcs.danar(id, hb.dan, q, d, &mut self.fis, Some(npc::Quien::Jugador)); self.ef.impacto(q, [-d[0], -d[1], -d[2]], efx::Sup::Cuerpo); }
                None => {
                    if let Some(i) = h.cuerpo.and_then(|c| self.objs.iter().position(|o| o.cuerpo == Some(c))) { self.danar_objeto(i, hb.dan); if let Some(cb) = h.cuerpo.and_then(|c| self.fis.cuerpo_mut(c)) { cb.despertar(); let dv = (300.0 / cb.masa.max(1.0)).min(6.0); for c in 0..3 { cb.vel[c] += d[c] as f64 * dv; } } }
                    self.ef.impacto(q, [h.n[0] as f32, h.n[1] as f32, h.n[2] as f32], efx::Sup::Mundo);
                }
            }
        }
        if let Some(pj) = self.pj.as_mut() { pj.accion(personaje::Gesto::Tiro); }
        match hb.s_gm.first().cloned() { Some(s) => self.pill_sonar(&s, None, 0.8), None => self.sonido.tocar("pistol2Fire_1", 0.6, 1.0, None) }
    }
    /// la cámara del Pill en tercera persona: desde un poco arriba de los ojos, a su distancia (los grandes, más lejos)
    pub fn pill_camara(&self, mundo: &jxjuego::mundo::Mundo, ojos: [f32; 3], fw: [f32; 3]) -> Option<([f32; 3], [f32; 3])> {
        let d = self.gmod.pill.def.as_ref()?; if self.vehs.jugador.is_some() || self.muerto { return None; }
        let d0 = d.cam.unwrap_or(3.4); let tam = self.pj.as_ref().map(|p| p.tam).unwrap_or(1.0);
        let sube0 = 0.3 * tam.clamp(0.5, 1.6); let sube = mundo.rayo(ojos, [0.0, 1.0, 0.0], sube0 + 0.25).map(|h| (h.t - 0.25).max(0.0)).unwrap_or(sube0);
        let piv = [ojos[0], ojos[1] + sube, ojos[2]]; let dir = [-fw[0], -fw[1], -fw[2]];
        let l = mundo.rayo(piv, dir, d0 + 0.3).map(|h| (h.t - 0.3).max(0.3)).unwrap_or(d0);
        Some(([piv[0] + dir[0] * l, piv[1] + dir[1] * l, piv[2] + dir[2] * l], fw))
    }
    /// el HUD del Pill (pillHudPaso): su nombre, la vida, la barra de poder y las cuatro habilidades con su botón, su costo y
    /// su espera (gris mientras espera o si no alcanza el poder); a la izquierda, entre los textos de arriba y la palanca
    pub(crate) fn pill_hud(&self, l: &Letras, u: &mut Vec<f32>, wf: f32, hf: f32) {
        let Some(d) = &self.gmod.pill.def else { return }; let p = &self.gmod.pill;
        let ts = hf * 0.03; let (x, y, w) = (wf * 0.012, hf * 0.2, wf * 0.27); let fila = ts * 1.35;
        let n = d.hab.iter().filter(|h| h.is_some()).count() as f32;
        l.caja(u, x, y, w, ts * 3.4 + fila * n + ts * 0.5, ts * 0.4, [0.04, 0.04, 0.06, 0.62]);
        l.texto(u, x + ts * 0.4, y + ts * 0.3, ts, [1.0, 1.0, 1.0, 0.97], &format!("{} · {} / {}", d.nom, self.jug.vida.max(0.0).round(), p.vida_max.round()));
        let (bx, by, bw, bh) = (x + ts * 0.4, y + ts * 1.6, w - ts * 0.8, ts * 0.55);
        l.caja(u, bx, by, bw, bh, bh * 0.4, [1.0, 1.0, 1.0, 0.14]);
        let col = if p.pod < 25.0 { [1.0, 0.42, 0.24, 1.0] } else if d.cat == "fnaf" { [1.0, 0.75, 0.2, 1.0] } else { [0.35, 0.78, 1.0, 1.0] };
        l.caja(u, bx, by, bw * (p.pod / 100.0).clamp(0.0, 1.0), bh, bh * 0.4, col);
        l.texto(u, bx, by + bh + ts * 0.15, ts * 0.7, [1.0, 1.0, 1.0, 0.85], if d.cat == "fnaf" { "FNAF Power" } else { "Poder" });
        let noms = ["Disparar", "Secundario", "Correr", "Recargar"]; let mut yy = y + ts * 3.4;
        for (i, hb) in d.hab.iter().enumerate() {
            let Some(hb) = hb else { continue };
            let gris = p.cd[i] > 0.0 || p.pod + 1e-6 < hb.costo || (hb.t == "carrera" && p.pod <= 0.5);
            let txt = format!("{}: {}{}", noms[i], nombre_hab(hb), if hb.costo > 0.0 { format!(" ({})", hb.costo as i32) } else { String::new() });
            let c = if i == 2 && p.carrera { [1.0, 0.85, 0.3, 1.0] } else if gris { [0.68, 0.68, 0.7, 0.85] } else { [1.0, 1.0, 1.0, 1.0] };
            l.texto(u, x + ts * 0.4, yy, ts * 0.8, c, &txt);
            if p.cd[i] > 0.0 && hb.cd > 0.0 { let k = (p.cd[i] / hb.cd).clamp(0.0, 1.0); l.caja(u, x + ts * 0.4, yy + ts * 0.92, (w - ts * 0.8) * k, ts * 0.12, 1.0, [1.0, 1.0, 1.0, 0.5]); }
            yy += fila;
        }
    }
}
/// el nombre de cada habilidad para el HUD
pub fn nombre_hab(h: &Hab) -> &'static str {
    match h.t { "golpe" => "Golpe", "susto" => "Susto", "carrera" => "Carrera", "cajita" => "Cajita musical", "tele" => "Teletransporte", "curar" => "Curar", "embestida" => "Embestida", "salto" => "Supersalto", "rafaga" => "Ráfaga", "disparo" => "Disparo", "lua" => "Habilidad", _ => "" }
}
