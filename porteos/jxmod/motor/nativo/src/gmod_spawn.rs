//! Los NPC y los vehículos de los addons (juego/gmod_spawn.js), como en el menú de GMod: list.Set("NPC", …) trae su
//! clase, su modelo, su vida y sus armas; list.Set("Vehicles", …) el modelo y el script del vehículo
//! (scripts/vehicles/*.txt: radio de las ruedas, masa).
//! - NPC con una clase del motor (npc_citizen, npc_metropolice, npc_combine_s, zombis…): un NPC del juego (camina, choca,
//!   se cae como muñeco, recibe tiros: npc.rs) con el modelo del addon puesto como un modelo de jugador (gmod_pm.rs), y una
//!   actitud según la clase (los combine y los zombis persiguen y pegan; los ciudadanos pasean). Un SNPC o un NPC de VJ
//!   Base (la IA del motor de Source, que acá no está) también, con lo que dice su Lua (modelo, vida, daño, amigo o
//!   enemigo). Con una clase propia del addon (nextbots, entidades): esa entidad con su Lua.
//! - Cualquier modelo de personaje de un addon como NPC (gmnpcModelo) o como muñeco de trapo (gmragModelo).
//! - Vehículo: el .mdl partido en carrocería y ruedas (cada vértice va con el hueso que más lo mueve: los Wheel_* son
//!   ruedas), con las ruedas del juego (suspensión y agarre: vehiculo.rs) donde el modelo tiene sus enganches
//!   wheel_fl/fr/rl/rr, el asiento a la altura de vehicle_driver_eyes y la masa y el radio de las ruedas del script. Los
//!   vehículos de Source miran a ±Y en su modelo: se giran para que miren a +Z como los del juego.
use super::gmod_modelos::MallaGm;
use super::*;
use jxgmod::formatos as gmf;
use jxjuego::fisica::{self as fz, Forma};
use jxjuego::forma::PrefabFisica;
use objetos::Parte;
use serde_json::{json, Value};

const GS: f64 = 0.0254;
/// GM_NPC_HOSTIL: las clases que persiguen y pegan
const HOSTIL: [&str; 18] = ["combine", "metropolice", "police", "zombi", "zombie", "antlion", "headcrab", "hunter", "strider", "manhack", "scanner", "poison", "fastzombie", "vortigaunt_hostile", "gunship", "soldier", "elite", "stalker"];
/// GM_NPC_MODELO: los modelos de las clases de HL2 cuando el addon no pone uno
const MODELO_CLASE: [(&str, &str); 16] = [("npc_citizen", "models/humans/group01/male_07.mdl"), ("npc_metropolice", "models/police.mdl"), ("npc_combine_s", "models/combine_soldier.mdl"), ("npc_zombie", "models/zombie/classic.mdl"),
    ("npc_fastzombie", "models/zombie/fast.mdl"), ("npc_alyx", "models/alyx.mdl"), ("npc_barney", "models/barney.mdl"), ("npc_kleiner", "models/kleiner.mdl"), ("npc_breen", "models/breen.mdl"), ("npc_eli", "models/eli.mdl"), ("npc_gman", "models/gman.mdl"),
    ("npc_monk", "models/monk.mdl"), ("npc_mossman", "models/mossman.mdl"), ("npc_antlion", "models/antlion.mdl"), ("npc_headcrab", "models/headcrabclassic.mdl"), ("npc_vortigaunt", "models/vortigaunt.mdl")];

/// el primer número de un "clave" "valor" del script del vehículo (_kv)
fn kv(s: &str, k: &str) -> f64 {
    let l = s.to_ascii_lowercase(); let pat = format!("\"{}\"", k.to_lowercase()); let mut desde = 0;
    while let Some(i) = l[desde..].find(&pat) {
        let i = desde + i + pat.len(); desde = i;
        let r = &s[i..]; let r2 = r.trim_start_matches(|c: char| c.is_whitespace()); if r2.len() == r.len() { continue; }
        let Some(r3) = r2.strip_prefix('"') else { continue };
        let n: String = r3.chars().take_while(|c| c.is_ascii_digit() || *c == '-' || *c == '.').collect();
        if n.is_empty() { continue; }
        return n.parse::<f64>().unwrap_or(f64::NAN);
    }
    f64::NAN
}
fn q2m(q: [f32; 4]) -> [[f64; 3]; 3] {
    let [x, y, z, w] = q.map(|v| v as f64);
    [[1.0 - 2.0 * (y * y + z * z), 2.0 * (x * y - z * w), 2.0 * (x * z + y * w)], [2.0 * (x * y + z * w), 1.0 - 2.0 * (x * x + z * z), 2.0 * (y * z - x * w)], [2.0 * (x * z - y * w), 2.0 * (y * z + x * w), 1.0 - 2.0 * (x * x + y * y)]]
}
fn m3mul(a: &[[f64; 3]; 3], b: &[[f64; 3]; 3]) -> [[f64; 3]; 3] { let mut o = [[0.0; 3]; 3]; for r in 0..3 { for c in 0..3 { o[r][c] = a[r][0] * b[0][c] + a[r][1] * b[1][c] + a[r][2] * b[2][c]; } } o }
/// Source → los ejes de los props del juego (y, z, x), en metros
fn pj(p: [f64; 3]) -> [f64; 3] { [p[1] * GS, p[2] * GS, p[0] * GS] }

impl Juego {
    /// un campo de una entrada de una lista de GMod
    fn gs_campo(&mut self, lista: &str, k: &str, campo: &str) -> String { self.gmod.gm.as_mut().map(|g| g.lista(lista)).unwrap_or_default().into_iter().find(|x| x.0 == k).and_then(|x| x.1.into_iter().find(|c| c.0 == campo).map(|c| c.1)).unwrap_or_default() }
    /// dónde poner un NPC del menú (gmnpcCrear): donde apunta (hasta 30 m) o, si no hay nada, 4 m adelante a la altura de los pies
    fn gs_donde(&mut self) -> Option<([f32; 3], f32)> {
        let (ojos, fw) = (self.ojos_ult, self.mira()); let mp = self.mapa.as_ref()?;
        let p = match self.fis.rayo(&mp.mundo, [ojos[0] as f64, ojos[1] as f64, ojos[2] as f64], [fw[0] as f64, fw[1] as f64, fw[2] as f64], 30.0, &[]) {
            Some(h) => [ojos[0] + fw[0] * h.t as f32, ojos[1] + fw[1] * h.t as f32, ojos[2] + fw[2] * h.t as f32],
            None => { let l = (fw[0] * fw[0] + fw[2] * fw[2]).sqrt().max(1e-6); [self.jug.pos[0] + fw[0] / l * 4.0, self.jug.pos[1] - self.jug.medio, self.jug.pos[2] + fw[2] / l * 4.0] }
        };
        Some((p, self.jug.yaw + std::f32::consts::PI))
    }
    /// un NPC del juego con un modelo de GMod (npcCrear con skin «gmpm:<ruta>»: por dentro el Hero), muñeco si se pide
    fn gs_npc(&mut self, m: &mut Motor3d, ruta: Option<&str>, p: [f32; 3], yaw: f32, act: npc::Actitud, muneco: bool) -> Option<u32> {
        let paq = self.paq.as_mut()?;
        let (mut c, e) = self.npc_skins.pedir(paq, "Hero", &mut self.pj_cargados).ok()?;
        if let Some(e) = e { unsafe { m.cargar(&e) }.ok()?; }
        if let Some(r) = ruta { c.pj.skin = format!("gmpm:{r}"); if !self.gmod.pm.defs.contains_key(r) { self.gmod.pm.pedidos.push(r.to_string()); } }
        let id = if muneco { self.npcs.crear_muneco(c, [p[0], p[1] + 0.15, p[2]], yaw, &mut self.fis) } else { self.npcs.crear(c, p, yaw, Some(act), &mut self.fis) };
        match id { Some(id) => { self.pila.push((true, id)); Some(id) } None => { self.avisar(format!("Ya hay {} NPC (el máximo)", self.npcs.max)); None } }
    }
    /// gmnpcCrear: un NPC de las listas de GMod. Devuelve true si se puso como NPC del juego (los de una clase del addon los
    /// crea su Lua: false)
    pub(crate) fn gs_npc_lista(&mut self, m: &mut Motor3d, k: &str) -> bool {
        let cls0 = { let c = self.gs_campo("NPC", k, "Class"); if c.is_empty() { k.to_string() } else { c } };
        let Some(gm) = self.gmod.gm.as_mut() else { return false };
        // (la clase, sin importar mayúsculas como en GMod)
        let cls = if !gm.es_clase(&cls0) && gm.es_clase(&cls0.to_lowercase()) { cls0.to_lowercase() } else { cls0.clone() };
        let Some((p, yaw)) = self.gs_donde() else { return true };
        // (un NPC de VJ Base o un SNPC: esa IA acá no está; un NPC del juego con lo que dice su Lua)
        let es_lua = self.gmod.gm.as_ref().map(|g| g.es_clase(&cls)).unwrap_or(false);
        if es_lua {
            let Some(sn) = self.gmod.gm.as_mut().and_then(|g| g.snpc(&cls)) else { return false };
            let act = if sn.hostil { npc::Actitud { modo: npc::Modo::Perseguir, vel: 3.0, obj: npc::Obj::Cerca, dist: 1.2, hostil: true, dano: sn.dano, vida: sn.vida, ..Default::default() } } else { npc::Actitud { modo: npc::Modo::Pasear, vel: 1.6, vida: sn.vida, ..Default::default() } };
            let r = if sn.modelo.is_empty() { None } else { Some(jxgmod::jugadores::ruta_mdl(&sn.modelo)) };
            self.gs_npc(m, r.as_deref(), p, yaw, act, false); return true;
        }
        // una clase del motor: un NPC del juego con el modelo del addon
        let modelo = { let x = self.gs_campo("NPC", k, "Model"); if x.trim().is_empty() { MODELO_CLASE.iter().find(|c| c.0 == cls).map(|c| c.1.to_string()).unwrap_or_default() } else { x } };
        let modelo = jxgmod::jugadores::ruta_mdl(&modelo);
        let (cl, kl) = (cls.to_lowercase(), k.to_lowercase());
        let hostil = HOSTIL.iter().any(|x| cl.contains(x) || kl.contains(x));
        let vida = self.gs_campo("NPC", k, "Health").parse::<f64>().ok().filter(|v| *v > 0.0).unwrap_or(if hostil { 60.0 } else { 100.0 });
        let act = if hostil { npc::Actitud { modo: npc::Modo::Perseguir, vel: 3.0, obj: npc::Obj::Cerca, dist: 1.2, hostil: true, dano: 8.0, vida, ..Default::default() } } else { npc::Actitud { modo: npc::Modo::Pasear, vel: 1.6, vida, ..Default::default() } };
        self.gs_npc(m, if modelo.is_empty() { None } else { Some(&modelo) }, p, yaw, act, false);
        true
    }
    /// gmnpcModelo: cualquier modelo de personaje de un addon como NPC (anda y pasea como los del juego, con ese modelo)
    pub(crate) fn gs_npc_modelo(&mut self, m: &mut Motor3d, ruta: &str) {
        let Some((p, yaw)) = self.gs_donde() else { return };
        self.gs_npc(m, Some(ruta), p, yaw, npc::Actitud { modo: npc::Modo::Pasear, vel: 1.6, vida: 100.0, ..Default::default() }, false);
    }
    /// gmragModelo: un muñeco de trapo con el modelo de un personaje (como un prop_ragdoll de GMod): adelante, cae con sus
    /// huesos, se agarra con la Physics Gun y no se levanta nunca
    pub(crate) fn gs_rag_modelo(&mut self, m: &mut Motor3d, ruta: &str) {
        let Some(mp) = self.mapa.as_ref() else { return }; let (ojos, fw) = (self.ojos_ult, self.mira());
        let p = match self.fis.rayo(&mp.mundo, [ojos[0] as f64, ojos[1] as f64, ojos[2] as f64], [fw[0] as f64, fw[1] as f64, fw[2] as f64], 30.0, &[]) {
            Some(h) => [ojos[0] + fw[0] * h.t as f32, ojos[1] + fw[1] * h.t as f32, ojos[2] + fw[2] * h.t as f32],
            None => { let l = (fw[0] * fw[0] + fw[2] * fw[2]).sqrt().max(1e-6); [self.jug.pos[0] + fw[0] / l * 2.5, self.jug.pos[1] - self.jug.medio, self.jug.pos[2] + fw[2] / l * 2.5] }
        };
        let yaw = (self.jug.pos[0] - p[0]).atan2(self.jug.pos[2] - p[2]);
        self.gs_npc(m, Some(ruta), p, yaw, npc::Actitud { modo: npc::Modo::Quieto, vida: 100.0, ..Default::default() }, true);
    }

    /// gmEsMuneco: ¿un modelo con esqueleto humano de Valve y física de muñeco (varias piezas en su .phy)? → se pone como
    /// muñeco de trapo
    pub(crate) fn gs_es_muneco(&self, ruta: &str) -> bool {
        let Some(gm) = self.gmod.gm.as_ref() else { return false };
        let Some(phy) = gm.archivo(&format!("{}.phy", &ruta[..ruta.len().saturating_sub(4)])) else { return false };
        if phy.len() < 12 || i32::from_le_bytes([phy[8], phy[9], phy[10], phy[11]]) < 2 { return false; }
        let Some(b) = gm.archivo(ruta) else { return false }; let Ok(m) = gmf::mdl(b, None, None) else { return false };
        m.huesos.iter().any(|h| h.n.eq_ignore_ascii_case("valvebiped.bip01_pelvis"))
    }
    // ---------------- vehículos ----------------
    /// gmvehPrefab: el prefab de un vehículo de las listas (carrocería, ruedas, asiento) y su forma de choque; el nombre
    /// del prefab («gmveh:<clave>») o None si no se puede
    pub(crate) fn gs_veh_prefab(&mut self, m: &mut Motor3d, key: &str) -> Option<String> {
        let nombre = format!("gmveh:{key}"); if self.prefabs.contains_key(&nombre) { return Some(nombre); }
        let ruta = jxgmod::jugadores::ruta_mdl(&self.gs_campo("Vehicles", key, "Model")); if ruta.is_empty() { return None; }
        let base = self.gm_modelo(m, &ruta)?;   // (la masa del .phy, como un prop)
        let masa0 = base.fis.as_ref().map(|f| f.masa).unwrap_or(400.0);
        let gm = self.gmod.gm.as_ref()?; let md = gm.modelo(&ruta)?; let mm = md.m.clone(); let v = mm.v.as_ref()?;
        let sc = self.gs_campo("Vehicles", key, "kv.KeyValues.vehiclescript").to_lowercase().replace('\\', "/");
        let s = if sc.is_empty() { String::new() } else { self.gmod.gm.as_ref().and_then(|g| g.archivo(&sc)).map(|b| b.iter().map(|&c| c as char).collect()).unwrap_or_default() };
        let clase = self.gs_campo("Vehicles", key, "Class");
        // los huesos en reposo (en Source) y los enganches
        let h = &mm.huesos; let (mut rw, mut tw): (Vec<[[f64; 3]; 3]>, Vec<[f64; 3]>) = (vec![], vec![]);
        for x in h { let r = q2m(x.q); let t = [x.pos[0] as f64, x.pos[1] as f64, x.pos[2] as f64]; if x.pa < 0 || x.pa as usize >= rw.len() { rw.push(r); tw.push(t); } else { let (rp, tp) = (rw[x.pa as usize], tw[x.pa as usize]); rw.push(m3mul(&rp, &r)); tw.push([0, 1, 2].map(|c| tp[c] + rp[c][0] * t[0] + rp[c][1] * t[1] + rp[c][2] * t[2])); } }
        let adj = |re: &dyn Fn(&str) -> bool| -> Option<[f64; 3]> {
            let a = mm.adjuntos.iter().find(|a| re(&a.n.to_lowercase()))?; let l = [a.m[3] as f64, a.m[7] as f64, a.m[11] as f64];
            if a.hueso < 0 || a.hueso as usize >= rw.len() { return Some(l); }
            let (r, t) = (rw[a.hueso as usize], tw[a.hueso as usize]); Some([0, 1, 2].map(|c| t[c] + r[c][0] * l[0] + r[c][1] * l[1] + r[c][2] * l[2]))
        };
        // de qué rueda es cada hueso (los Wheel_* que no cuelgan de otro, y lo que cuelga de ellos)
        let mut rueda: Vec<i32> = vec![-1; h.len()]; let mut ruedas: Vec<(usize, String, [f64; 3])> = vec![];
        for (i, x) in h.iter().enumerate() {
            let n = x.n.to_lowercase(); let pa_r = if x.pa >= 0 && (x.pa as usize) < i { rueda[x.pa as usize] } else { -1 };
            if n.contains("wheel") && !n.contains("steer") && pa_r < 0 {
                rueda[i] = ruedas.len() as i32;
                let mut nn = match n.rfind("wheel") { Some(k) => n[k + 5..].trim_start_matches('_').to_string(), None => n.clone() };
                for suf in ["_turn", "_rotate", "_parent", "_spin", "_axle"] { if let Some(k) = nn.find(suf) { nn.truncate(k); } }
                ruedas.push((i, nn, [0.0; 3]));
            } else if pa_r >= 0 { rueda[i] = pa_r; }
        }
        // (las UV de cada malla llevadas cerca de 0, de a enteros: gmUVcorr)
        let mut uc = vec![[0f32; 2]; v.n];
        for g in &mm.mallas { let (mut mu, mut mv) = (f32::MAX, f32::MAX); for &k in &g.tris { mu = mu.min(v.uv[k as usize][0]); mv = mv.min(v.uv[k as usize][1]); } if mu > 1e8 { continue; } for &k in &g.tris { uc[k as usize] = [mu.floor(), mv.floor()]; } }
        let de_vert = |k: usize| { let (mut b, mut w) = (v.hb[k][0] as usize, v.w[k][0]); for c in 1..3 { if v.w[k][c] > w { w = v.w[k][c]; b = v.hb[k][c] as usize; } } rueda.get(b).copied().unwrap_or(-1) };
        // las caras por parte (carrocería y cada rueda) y material
        let piel = mm.pieles.first().cloned().unwrap_or_default();
        let mut partes: Vec<Vec<(i64, Vec<u32>)>> = vec![vec![]; 1 + ruedas.len()];
        for g in &mm.mallas {
            if g.modelo != 0 { continue; }
            let ti = piel.get(g.mat as usize).map(|&x| x as usize).unwrap_or(g.mat as usize);
            let tex = mm.texturas.get(ti).or_else(|| mm.texturas.get(g.mat as usize)).cloned().unwrap_or_else(|| "error".into());
            let (mat, dos) = self.gm_material(m, &tex, &mm.carpetas);
            for t in g.tris.chunks_exact(3) {
                let pz = &mut partes[(1 + de_vert(t[0] as usize)) as usize];
                let l = match pz.iter_mut().position(|x| x.0 == mat) { Some(i) => &mut pz[i].1, None => { pz.push((mat, vec![])); &mut pz.last_mut().unwrap().1 } };
                l.extend_from_slice(&[t[0], t[2], t[1]]); if dos { l.extend_from_slice(&[t[0], t[1], t[2]]); }
            }
        }
        // el centro de cada rueda: su enganche wheel_xx (si no, el centro de su malla)
        for (i, r) in ruedas.iter_mut().enumerate() {
            let nn = r.1.clone();
            r.2 = match adj(&|n: &str| n.strip_prefix("wheel").map(|x| x == nn || x.strip_prefix('_') == Some(nn.as_str())).unwrap_or(false)) {
                Some(a) => a,
                None => { let (mut mn, mut mx, mut hay) = ([1e9f64; 3], [-1e9f64; 3], false); for (_, l) in &partes[1 + i] { for &k in l { hay = true; for c in 0..3 { mn[c] = mn[c].min(v.pos[k as usize][c] as f64); mx[c] = mx[c].max(v.pos[k as usize][c] as f64); } } } if hay { [0, 1, 2].map(|c| (mn[c] + mx[c]) / 2.0) } else { tw[r.0] } }
            };
        }
        // una malla por parte (la de cada rueda con el centro de la rueda en su 0)
        let mut malla = |j: &mut Juego, pz: &[(i64, Vec<u32>)], c: [f64; 3]| -> Option<(MallaGm, Vec<[f64; 3]>)> {
            let mut usados: HashMap<u32, u32> = HashMap::new(); let (mut pp, mut nn, mut uu) = (vec![], vec![], vec![]); let mut por: Vec<(i64, Vec<u32>)> = vec![];
            for (mat, l) in pz { let mut ix = vec![]; for &k in l { let jj = *usados.entry(k).or_insert_with(|| { let q = v.pos[k as usize]; let g = pj([q[0] as f64 - c[0], q[1] as f64 - c[1], q[2] as f64 - c[2]]); pp.push([g[0] as f32, g[1] as f32, g[2] as f32]); let nr = v.nor[k as usize]; nn.push([nr[1], nr[2], nr[0]]); let u = v.uv[k as usize]; let cc = uc[k as usize]; uu.push([u[0] - cc[0], u[1] - cc[1]]); (pp.len() - 1) as u32 }); ix.push(jj); } por.push((*mat, ix)); }
            if pp.is_empty() { return None; }
            let pts: Vec<[f64; 3]> = pp.iter().map(|p| [p[0] as f64, p[1] as f64, p[2] as f64]).collect();
            j.gm_subir(m, &pp, &nn, &uu, &por, None).map(|x| (x, pts))
        };
        let masa = { let x = kv(&s, "MassOverride"); if x > 0.0 { x } else { masa0 } }.clamp(50.0, 50000.0);
        let radio = { let x = kv(&s, "Radius"); if x > 0.0 { x } else { 15.0 } } * GS; let nr = ruedas.len().max(1) as f64; let sd = 0.18;
        let sp = masa * 9.8 / nr / (sd * 0.5); let da = 0.25 * 2.0 * (sp * masa / nr).sqrt() / 1.8;
        let partes0 = partes[0].clone();
        let (cuerpo, pts_c) = malla(self, &partes0, [0.0; 3])?;
        // ¿para dónde mira? adelante es +z para el juego: los enganches de las ruedas dicen dónde está la trompa (en los de
        // HL2 queda del lado de −Y de Source y con el giro de siempre andaba marcha atrás: ahí se gira al revés)
        let (mut y_f, mut y_r) = (vec![], vec![]);
        for a in &mm.adjuntos {
            let n = a.n.to_lowercase(); let Some(x) = n.strip_prefix("wheel") else { continue }; let x = x.trim_start_matches('_');
            let ok = matches!(x.len(), 1 | 2) && (x.starts_with('f') || x.starts_with('r')) && (x.len() == 1 || x.ends_with('l') || x.ends_with('r'));
            if !ok { continue; } let nn = n.clone();
            if let Some(p) = adj(&|q: &str| q == nn) { if x.starts_with('f') { y_f.push(p[1]); } else { y_r.push(p[1]); } }
        }
        if y_f.is_empty() || y_r.is_empty() { for r in &ruedas { if r.1.starts_with('f') { y_f.push(r.2[1]); } else if r.1.starts_with('r') { y_r.push(r.2[1]); } } }
        let prom = |l: &[f64]| l.iter().sum::<f64>() / l.len() as f64;
        let al_reves = !y_f.is_empty() && !y_r.is_empty() && prom(&y_f) < prom(&y_r);
        let s2 = std::f64::consts::FRAC_1_SQRT_2; let rq = if al_reves { [0.0, s2, 0.0, s2] } else { [0.0, -s2, 0.0, s2] };
        // (los números de las mallas en DATA.ms para vehiculo.rs: su caja; las mallas de verdad son las de los addons)
        let paq = self.paq.as_mut()?;
        if !paq.d["ms"].is_array() { return None; }
        let mut meta = |mn: [f32; 3], mx: [f32; 3]| -> i64 { let ms = paq.d["ms"].as_array_mut().unwrap(); ms.push(json!({ "mn": mn, "sc": [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]], "gm": true })); (ms.len() - 1) as i64 };
        let caja_de = |pts: &[[f64; 3]]| { let (mut mn, mut mx) = ([f32::MAX; 3], [f32::MIN; 3]); for p in pts { for c in 0..3 { mn[c] = mn[c].min(p[c] as f32); mx[c] = mx[c].max(p[c] as f32); } } (mn, mx) };
        let (cmn, cmx) = caja_de(&pts_c); let m_c = meta(cmn, cmx);
        let mut arb = vec![json!({ "n": nombre, "p": [0, 0, 0], "r": rq, "s": [1, 1, 1], "pa": -1, "rb": { "m": masa }, "mb": ["Vehicle", "SCC_Drivetrain"], "gm": ruta }),
            json!({ "n": "Carroceria", "p": [0, 0, 0], "r": [0, 0, 0, 1], "s": [1, 1, 1], "pa": 0, "m": m_c })];
        let mut mallas_nodo: Vec<(usize, MallaGm)> = vec![(1, cuerpo)];
        for (i, r) in ruedas.iter().enumerate() {
            let pz = partes[1 + i].clone(); let c = pj(r.2);
            if let Some((g, pts)) = malla(self, &pz, r.2) {
                let (mn, mx) = caja_de(&pts); let paq = self.paq.as_mut()?; let ms = paq.d["ms"].as_array_mut().unwrap(); ms.push(json!({ "mn": mn, "sc": [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]], "gm": true })); let mi = (ms.len() - 1) as i64;
                mallas_nodo.push((arb.len(), g)); arb.push(json!({ "n": format!("wheel_{}", r.1), "p": c, "r": [0, 0, 0, 1], "s": [1, 1, 1], "pa": 0, "m": mi }));
            }
            arb.push(json!({ "n": format!("WC_{}", r.1), "p": c, "r": [0, 0, 0, 1], "s": [1, 1, 1], "pa": 0, "wc": { "c": [0, 0, 0], "r": radio, "sd": sd, "sp": sp, "da": da } }));
        }
        // (sin ruedas, como los botes y el airboat: cuatro apoyos que no se ven en las puntas de abajo del casco)
        if ruedas.is_empty() {
            let (mut mn, mut mx) = ([1e9f64; 3], [-1e9f64; 3]); for k in 0..v.n { for c in 0..3 { mn[c] = mn[c].min(v.pos[k][c] as f64); mx[c] = mx[c].max(v.pos[k][c] as f64); } }
            let r = 0.15f64.max(0.5f64.min((mx[2] - mn[2]) * GS * 0.15)); let (cx, cy, ax, ay) = ((mn[0] + mx[0]) / 2.0, (mn[1] + mx[1]) / 2.0, (mx[0] - mn[0]) * 0.35, (mx[1] - mn[1]) * 0.35);
            for (sx, sy, nn) in [(-1.0, 1.0, "fl"), (1.0, 1.0, "fr"), (-1.0, -1.0, "rl"), (1.0, -1.0, "rr")] { let p = pj([cx + sx * ax, cy + sy * ay, mn[2] + r / GS]); arb.push(json!({ "n": format!("WC_{nn}"), "p": p, "r": [0, 0, 0, 1], "s": [1, 1, 1], "pa": 0, "wc": { "c": [0, 0, 0], "r": r, "sd": sd, "sp": sp, "da": da } })); }
        }
        match adj(&|n: &str| n == "vehicle_driver_eyes") {
            Some(o) => { let mut p = pj(o); p[1] -= 0.75; arb.push(json!({ "n": "SitPoint", "p": p, "r": [0, 0, 0, 1], "s": [1, 1, 1], "pa": 0 })); }
            None => arb.push(json!({ "n": "SitPoint", "p": [cmn[0] + (cmx[0] - cmn[0]) / 2.0, cmn[1] + (cmx[1] - cmn[1]) * 0.55, cmn[2] + (cmx[2] - cmn[2]) / 2.0], "r": [0, 0, 0, 1], "s": [1, 1, 1], "pa": 0 })),
        }
        // (un bote —el Airboat de HL2, o uno sin ruedas con «boat» en el nombre—: flota y se maneja en el agua)
        let todo = format!("{} {} {}", clase, sc, ruta).to_lowercase(); let kr = format!("{key} {ruta}").to_lowercase();
        let bote = todo.contains("airboat") || (ruedas.is_empty() && ["boat", "lancha", "jetski", "barco"].iter().any(|x| kr.contains(x)));
        if bote { arb[0]["bote"] = json!(true); }
        let clave = format!("{nombre}#gm");
        // la forma de choque: el casco de la carrocería, en el marco del prefab (con el giro de la raíz)
        let rot = |p: [f64; 3]| fz::rot(rq, p);
        let pts_r: Vec<[f64; 3]> = { let paso = (pts_c.len() / 3000).max(1); pts_c.iter().step_by(paso).map(|p| rot(*p)).collect() };
        let (h_c, c, _) = jxjuego::forma::casco_de_puntos(&pts_r, false);
        let pfz = Arc::new(PrefabFisica { nombre: nombre.clone(), clave: clave.clone(), forma: Arc::new(Forma::Casco(h_c)), c, eje_cap: None, cap_q: None, partes: 1, masa, fric: 0.6, rest: 0.12, tipo: "vehiculo", sin_fisica: false, congelado: false, salta: false, snd: "metal".into(), dens: None });
        // lo que se dibuja: cada malla en su nodo (vehiculo.rs mueve las ruedas)
        let mut prf = objetos::Prefab { nombre: nombre.clone(), partes: vec![], caja: [f32::MAX, f32::MAX, f32::MAX, f32::MIN, f32::MIN, f32::MIN] };
        let rq32 = [rq[0] as f32, rq[1] as f32, rq[2] as f32, rq[3] as f32];
        for (nodo, g) in &mallas_nodo {
            let p = &arb[*nodo]["p"]; let pn = [p[0].as_f64().unwrap_or(0.0) as f32, p[1].as_f64().unwrap_or(0.0) as f32, p[2].as_f64().unwrap_or(0.0) as f32];
            let local = m4::mul(&mapa::trs([0.0; 3], rq32, [1.0; 3]), &mapa::trs(pn, [0.0, 0.0, 0.0, 1.0], [1.0; 3]));
            let ce = [local[0] * g.esf[0] + local[4] * g.esf[1] + local[8] * g.esf[2] + local[12], local[1] * g.esf[0] + local[5] * g.esf[1] + local[9] * g.esf[2] + local[13], local[2] * g.esf[0] + local[6] * g.esf[1] + local[10] * g.esf[2] + local[14]];
            for k in 0..3 { prf.caja[k] = prf.caja[k].min(ce[k] - g.esf[3]); prf.caja[k + 3] = prf.caja[k + 3].max(ce[k] + g.esf[3]); }
            for &(s0, sn, mat) in &g.partes { prf.partes.push(Parte { m: g.m, s0, sn, mat, local, esf: [ce[0], ce[1], ce[2], g.esf[3]], nodo: *nodo }); }
        }
        let paq = self.paq.as_mut()?;
        if !paq.d["pf"].is_object() { paq.d["pf"] = json!({}); }
        paq.d["pf"][&clave] = Value::Array(arb);
        self.prefabs.insert(nombre.clone(), prf);
        self.gmod.veh_fis.insert(nombre.clone(), pfz);
        Some(nombre)
    }
    /// (para las pruebas) el árbol del prefab de un vehículo de las listas («gmveh:<clave>»), si ya se armó
    pub fn gs_arbol(&self, nombre: &str) -> Option<Value> { self.paq.as_ref().and_then(|p| p.d["pf"].get(format!("{nombre}#gm")).cloned()) }
    /// poner un vehículo de las listas donde se mira (spawnDelante: con su base en el punto, girado como el jugador + 180°)
    pub(crate) fn gs_veh_poner(&mut self, m: &mut Motor3d, key: &str) -> bool {
        let Some(nombre) = self.gs_veh_prefab(m, key) else { return false };
        let Some(pfz) = self.gmod.veh_fis.get(&nombre).cloned() else { return false };
        let Some(mp) = self.mapa.as_ref() else { return false }; let (ojos, fw) = (self.ojos_ult, self.mira());
        let (o64, d64) = ([ojos[0] as f64, ojos[1] as f64, ojos[2] as f64], [fw[0] as f64, fw[1] as f64, fw[2] as f64]);
        let p = match self.fis.rayo(&mp.mundo, o64, d64, 40.0, &[]) { Some(g) => { let t = (g.t as f32 - 0.05).max(0.5); [ojos[0] + fw[0] * t, ojos[1] + fw[1] * t, ojos[2] + fw[2] * t] }
            None => { let mut q = [ojos[0] + fw[0] * 6.0, ojos[1] + fw[1] * 6.0, ojos[2] + fw[2] * 6.0]; if let Some(g) = mp.mundo.rayo(q, [0.0, -1.0, 0.0], 50.0) { q[1] -= g.t; } q } };
        let giro = self.jug.yaw + std::f32::consts::PI; let q = [0.0, (giro / 2.0).sin() as f64, 0.0, (giro / 2.0).cos() as f64];
        let b = jxjuego::forma::cuerpo_de_prefab(&pfz, [p[0] as f64, p[1] as f64, p[2] as f64], q, false);
        let (bp, bq) = ([b.pos[0] as f32, b.pos[1] as f32, b.pos[2] as f32], [b.q[0] as f32, b.q[1] as f32, b.q[2] as f32, b.q[3] as f32]);
        let masa = b.masa as f32; let id = self.fis.agregar(b);
        self.aguas.registrar(id, Flota::de_prefab(&pfz));
        if let Some(paq) = self.paq.as_ref() { self.vehs.agregar(paq, &pfz, id, &mut self.fis, Some(&mut self.aguas)); }
        let id_obj = self.sig_id; self.sig_id += 1;
        self.objs.push(Obj { nombre: nombre.clone(), pos: bp, q: bq, c: [pfz.c[0] as f32, pfz.c[1] as f32, pfz.c[2] as f32], cuerpo: Some(id), cap_inv: [0.0, 0.0, 0.0, 1.0], ant: (bp, bq), masa, id: id_obj, logica: None, log_base: None, tipo: "vehiculo", vida: 0.0, exploto: false });
        self.pila.push((false, id_obj));
        let n = self.gs_campo("Vehicles", key, "Name"); self.avisar(format!("Puesto: {}", if n.trim().is_empty() { key.to_string() } else { n }));
        true
    }
}
