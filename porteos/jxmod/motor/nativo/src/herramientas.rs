//! La Tool Gun, como herramientas.js: las 20 herramientas del juego (DATA.herr) con sus parámetros. Las que ponen una cosa
//! (Button, LogicGate, Timer, Spawner, Remover, Repulsor, Monitor, Mover, LocalRotator, LocalMover, Trigger, Lamp,
//! PasswordPanel, SpawnPoint…) la dejan congelada donde apuntás, apoyada en la superficie; Wire une la salida de una con la
//! entrada de otra; Remove borra; Duplicate copia. Señales: Button, Timer, Trigger, PasswordPanel y LogicGate dan
//! verdadero o falso; lo demás se prende con eso (sin cables, siempre). Es un hijo de comun.rs (usa el juego por dentro).
use super::*;
use jxjuego::vista;
use serde_json::Value;

/// el valor de un parámetro (texto, número o sí/no)
#[derive(Clone, Debug, PartialEq)]
pub enum Valor { Txt(String), Num(f32), Si(bool) }
impl Valor {
    pub fn num(&self) -> f32 { match self { Valor::Num(x) => *x, Valor::Txt(t) => t.parse().unwrap_or(0.0), Valor::Si(b) => *b as u8 as f32 } }
    pub fn txt(&self) -> String { match self { Valor::Txt(t) => t.clone(), Valor::Num(x) => if x.fract() == 0.0 { format!("{x:.0}") } else { format!("{x:.1}") }, Valor::Si(b) => if *b { "Sí".into() } else { "No".into() } } }
    pub fn si(&self) -> bool { match self { Valor::Si(b) => *b, Valor::Num(x) => *x != 0.0, Valor::Txt(t) => !t.is_empty() } }
}
/// un parámetro de una herramienta: el nombre, el tipo (String, String[], Boolean, Single, Int32) y las opciones
pub struct Param { pub n: String, pub t: String, pub o: Vec<String> }
pub struct Herr { pub n: String, pub p: Vec<Param> }
/// lo que hace una cosa de la Tool Gun puesta en el mundo (o.logica)
pub struct Logica { pub tipo: String, pub params: HashMap<String, Valor>, pub entradas: Vec<u32>, pub salida: bool, pub t: f32, pub luz: bool, pub texto: String, pub color: String }
/// las herramientas: la lista, la elegida, los parámetros de cada una, el cable empezado, las trazas y lo que tiró un Spawner
#[derive(Default)]
pub struct Herramientas { pub lista: Vec<Herr>, pub sel: usize, pub params: HashMap<String, HashMap<String, Valor>>, pub cable: Option<u32>, pub trazas: Vec<([f32; 3], [f32; 3], f32)>, pub tirados: Vec<(u32, f32)>, pub spawn: Option<[f32; 3]> }

/// la herramienta de un nombre de la lista al prefab que pone (PREFAB_HER)
fn prefab_de(n: &str) -> &str { match n { "SimpleNextbot" | "Nextbot" => "Nextbot", x => x } }
/// lo que vale un parámetro al elegir la herramienta (equiparHerramienta)
fn por_defecto(p: &Param) -> Valor {
    match p.t.as_str() {
        "String[]" => Valor::Txt(p.o.first().cloned().unwrap_or_default()),
        "Boolean" => Valor::Si(false),
        "Single" => Valor::Num(if p.n.contains("Speed") { 2.0 } else if p.n.contains("Distance") || p.n.contains("Size") || p.n.contains("Range") { 4.0 } else if p.n.contains("Force") { 20.0 } else if p.n.contains("Degree") { 90.0 } else { 1.0 }),
        "Int32" => Valor::Num(0.0),
        _ => Valor::Txt(if p.n == "Prop name" { "Crate".into() } else if p.n == "Password" { "1234".into() } else { String::new() }),
    }
}
/// DATA.herr
pub fn lista(d: &Value) -> Vec<Herr> {
    d["herr"].as_array().map(|a| a.iter().map(|h| Herr { n: h["n"].as_str().unwrap_or("").to_string(),
        p: h["p"].as_array().map(|ps| ps.iter().map(|p| Param { n: p["n"].as_str().unwrap_or("").to_string(), t: p["t"].as_str().unwrap_or("").to_string(),
            o: p["o"].as_array().map(|o| o.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect()).unwrap_or_default() }).collect()).unwrap_or_default() }).collect()).unwrap_or_default()
}
/// la ayuda de cada una (inspectorHerramienta)
pub fn ayuda(n: &str) -> &'static str {
    match n {
        "Remove" => "Disparo: borra lo que apuntás.", "Duplicate" => "Disparo: copia lo que apuntás.",
        "Wire" => "Disparo en lo que da la señal y después en lo que la recibe.",
        "Mover" => "Prop Id 0 = se mueve él mismo; si no, el objeto de ese ID (apuntalo con «2» para verlo).",
        "LocalRotator" | "LocalMover" => "Prop Id 0 = él mismo; si no, el objeto de ese ID.",
        "Button" => "«2» sobre el botón lo prende y apaga.", "Trigger" => "Da señal cuando algo entra en su radio.",
        "Spawner" => "Tira un objeto cada segundo mientras tiene señal.", "SpawnPoint" => "Aparecés acá al caer o ahogarte.",
        _ => "Disparo: lo pone donde apuntás. «2»: el ID de lo que apuntás.",
    }
}
/// el giro apoyado sobre una superficie (arriba = la normal), mirándote (qSobre)
fn q_sobre(n: [f32; 3], yaw: f32) -> [f32; 4] {
    let a = yaw + std::f32::consts::PI; let qy = [0.0, (a / 2.0).sin(), 0.0, (a / 2.0).cos()];
    let d = n[1]; if d > 0.999 { return qy; }
    let ax = [n[2], 0.0, -n[0]]; let l = (ax[0] * ax[0] + ax[2] * ax[2]).sqrt().max(1e-9); let ang = d.clamp(-1.0, 1.0).acos(); let s = (ang / 2.0).sin();
    qmul32([ax[0] / l * s, 0.0, ax[2] / l * s, (ang / 2.0).cos()], qy)
}
fn eje(s: &str) -> [f32; 3] { match s { "X" => [1.0, 0.0, 0.0], "Z" => [0.0, 0.0, 1.0], _ => [0.0, 1.0, 0.0] } }
fn qrot32(q: [f32; 4], v: [f32; 3]) -> [f32; 3] {
    let (x, y, z, w) = (q[0], q[1], q[2], q[3]); let (ix, iy, iz, iw) = (w * v[0] + y * v[2] - z * v[1], w * v[1] + z * v[0] - x * v[2], w * v[2] + x * v[1] - y * v[0], -x * v[0] - y * v[1] - z * v[2]);
    [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x]
}
fn dist(a: [f32; 3], b: [f32; 3]) -> f32 { ((a[0] - b[0]).powi(2) + (a[1] - b[1]).powi(2) + (a[2] - b[2]).powi(2)).sqrt() }

impl Juego {
    /// equiparHerramienta: elige la herramienta i y saca la Tool Gun
    pub fn equipar_herramienta(&mut self, i: usize) {
        let Some(h) = self.her.lista.get(i) else { return };
        self.her.sel = i; let n = h.n.clone();
        if !self.her.params.contains_key(&n) { let p: HashMap<String, Valor> = h.p.iter().map(|p| (p.n.clone(), por_defecto(p))).collect(); self.her.params.insert(n.clone(), p); }
        self.her.cable = None;
        if let Some(k) = ARMAS.iter().position(|a| a.n == "ToolBaton") { if self.armas.i != k { self.armas.elegir(&mut self.fis, k); } }
        self.avisar(format!("Tool Gun: {n}"));
    }
    /// el objeto que tiene el cuerpo `id`
    fn obj_de_cuerpo(&self, id: u32) -> Option<usize> { self.objs.iter().position(|o| o.cuerpo == Some(id)) }
    fn obj_por_id(&self, id: u32) -> Option<usize> { self.objs.iter().position(|o| o.id == id) }
    /// saca un objeto (y su cuerpo) del mundo
    pub(super) fn borrar_obj(&mut self, i: usize) {
        let o = self.objs.remove(i);
        if let Some(id) = o.cuerpo { if self.armas.agarre.as_ref().map(|a| a.id) == Some(id) || self.armas.grav.as_ref().map(|g| g.id) == Some(id) { self.armas.olvidar(); } self.fis.quitar(id); }
    }
    /// herramientaUsar: el disparo (o el «2», `alt`) de la Tool Gun
    pub(super) unsafe fn herramienta_usar(&mut self, m: &mut Motor3d, alt: bool) {
        let Some(h) = self.her.lista.get(self.her.sel) else { return };
        let n = h.n.clone();
        let (oj, f) = (self.ojos_ult, self.mira());
        let Some(mp) = self.mapa.as_ref() else { return };
        let r = self.fis.rayo(&mp.mundo, [oj[0] as f64, oj[1] as f64, oj[2] as f64], [f[0] as f64, f[1] as f64, f[2] as f64], 80.0, &[]);
        let fin = r.as_ref().map(|g| [g.p[0] as f32, g.p[1] as f32, g.p[2] as f32]).unwrap_or([oj[0] + f[0] * 80.0, oj[1] + f[1] * 80.0, oj[2] + f[2] * 80.0]);
        let boca = self.vista.as_ref().filter(|_| self.camara == 0).and_then(|v| v.punta()).unwrap_or([oj[0], oj[1] - 0.2, oj[2]]);
        self.her.trazas.push((boca, fin, 0.12));
        self.sonido.tocar("Click", 0.5, 1.4, None);
        let o = r.as_ref().and_then(|g| g.cuerpo).and_then(|id| self.obj_de_cuerpo(id));
        match n.as_str() {
            "Remove" => { if let Some(i) = o { self.borrar_obj(i); } return; }
            "Duplicate" => {
                if let Some(i) = o {
                    let (nom, id) = (self.objs[i].nombre.clone(), self.objs[i].cuerpo.unwrap_or(0));
                    if let Some(b) = self.fis.cuerpo(id) {
                        let a = b.aabb(); let p = [b.pos[0] as f32, (b.pos[1] + (a[4] - a[1]) + 0.05) as f32, b.pos[2] as f32];
                        let q = [b.q[0] as f32, b.q[1] as f32, b.q[2] as f32, b.q[3] as f32]; let cong = b.congelado;
                        let log = self.objs[i].logica.as_ref().map(|l| (l.tipo.clone(), l.params.clone()));
                        if let Ok(Some(k)) = self.crear(m, &nom, p, q, true, cong) { if let Some((t, pr)) = log { self.objs[k].logica = Some(Logica { tipo: t, params: pr, entradas: vec![], salida: false, t: 0.0, luz: false, texto: String::new(), color: String::new() }); } }
                    }
                }
                return;
            }
            "Wire" => {
                let Some(i) = o.filter(|&i| self.objs[i].logica.is_some()) else { self.her.cable = None; self.avisar("Apuntá a una de las cosas de la Tool Gun".into()); return };
                let id = self.objs[i].id;
                match self.her.cable {
                    None => { self.her.cable = Some(id); self.avisar("Ahora elegí a dónde llega la señal".into()); }
                    Some(c) if c != id => {
                        let de = self.obj_por_id(c).and_then(|k| self.objs[k].logica.as_ref().map(|l| l.tipo.clone())).unwrap_or_default();
                        if let Some(l) = self.objs[i].logica.as_mut() { if !l.entradas.contains(&c) { l.entradas.push(c); } let a = l.tipo.clone(); self.avisar(format!("Conectado: {de} → {a}")); }
                        self.her.cable = None;
                    }
                    _ => self.her.cable = None,
                }
                return;
            }
            _ => {}
        }
        if alt {
            // («2»: prende o apaga un botón, o dice el ID de lo apuntado)
            if let Some(i) = o {
                let pos = self.objs[i].pos;
                if let Some(l) = self.objs[i].logica.as_mut().filter(|l| l.tipo == "Button") { l.salida = !l.salida; self.sonido.tocar("Click", 0.8, 1.0, Some(pos)); }
                else { let t = format!("ID: {} · {}", self.objs[i].id, self.objs[i].nombre); self.avisar(t); }
            }
            return;
        }
        if n == "SimpleNextbot" || n == "Nextbot" { self.avisar("Los nextbots todavía no están en la versión nativa".into()); return; }
        let Some(g) = r else { return };
        let q = q_sobre([g.n[0] as f32, g.n[1] as f32, g.n[2] as f32], self.jug.yaw);
        let pre = prefab_de(&n).to_string();
        let params = self.her.params.get(&n).cloned().unwrap_or_default();
        match self.crear(m, &pre, fin, q, false, true) {
            Ok(Some(k)) => { self.objs[k].logica = Some(Logica { tipo: n, params, entradas: vec![], salida: false, t: 0.0, luz: false, texto: String::new(), color: "Black".into() }); }
            Ok(None) => {}
            Err(e) => self.avisar(format!("{pre}: {e}")),
        }
    }

    /// herramientasPaso: lo que hace cada cosa de la Tool Gun este cuadro (con `m`: el Spawner crea objetos)
    pub(super) unsafe fn herramientas_paso(&mut self, m: &mut Motor3d, dt: f32) {
        for t in self.her.trazas.iter_mut() { t.2 -= dt; } self.her.trazas.retain(|t| t.2 > 0.0);
        let ids: Vec<u32> = self.objs.iter().filter(|o| o.logica.is_some()).map(|o| o.id).collect();
        let salida = |objs: &Vec<Obj>, id: u32| objs.iter().find(|o| o.id == id).and_then(|o| o.logica.as_ref()).map(|l| l.salida);
        let mut crear: Vec<(String, [f32; 3], bool, f32)> = vec![]; let mut borrar: Vec<u32> = vec![];
        for id in ids {
            let Some(i) = self.obj_por_id(id) else { continue };
            let (pos, q) = (self.objs[i].pos, self.objs[i].q);
            let (tipo, entradas, p) = { let l = self.objs[i].logica.as_ref().unwrap(); (l.tipo.clone(), l.entradas.clone(), l.params.clone()) };
            let vivas: Vec<bool> = entradas.iter().filter_map(|e| salida(&self.objs, *e)).collect();
            let on = entradas.is_empty() || vivas.iter().any(|x| *x);
            let num = |k: &str, d: f32| p.get(k).map(|v| v.num()).filter(|x| *x != 0.0).unwrap_or(d);
            let txt = |k: &str| p.get(k).map(|v| v.txt()).unwrap_or_default();
            let mut nueva_salida: Option<bool> = None; let mut luz = None; let mut texto = None;
            if let Some(l) = self.objs[i].logica.as_mut() { l.t += dt; }
            let lt = self.objs[i].logica.as_ref().map(|l| l.t).unwrap_or(0.0);
            match tipo.as_str() {
                "LogicGate" => {
                    let n = vivas.iter().filter(|x| **x).count(); let v = vivas.len();
                    nueva_salida = Some(match txt("Mode").as_str() { "AND" => v > 0 && n == v, "OR" => n > 0, "XOR" => n % 2 == 1, "NAND" => !(v > 0 && n == v), "NOR" => n == 0, _ => n % 2 == 0 });
                }
                "Timer" => {
                    let t = num("Time", 1.0).max(0.1);
                    if let Some(l) = self.objs[i].logica.as_mut() { if on { if l.t >= t { l.t = 0.0; l.salida = !l.salida; } } else { l.salida = false; l.t = 0.0; } }
                }
                "Trigger" => {
                    let s = num("Size", 2.0).max(0.5); let modo = txt("Mode"); let nom = txt("Object name");
                    let mut hay = (modo == "Everything" || modo == "Player" || modo.is_empty()) && dist(self.jug.pos, pos) < s;
                    if !hay && modo != "Player" && modo != "Vehicle" { hay = self.objs.iter().any(|x| x.id != id && x.logica.is_none() && (nom.is_empty() || x.nombre == nom) && dist(x.pos, pos) < s); }
                    nueva_salida = Some(hay);
                }
                "Lamp" => luz = Some(on),
                "MonitorController" => nueva_salida = Some(on),
                "Monitor" => {
                    let c = entradas.iter().filter_map(|e| self.objs.iter().find(|o| o.id == *e)).find(|o| o.logica.as_ref().map(|l| l.tipo == "MonitorController").unwrap_or(false));
                    let t = c.and_then(|o| o.logica.as_ref()).map(|l| (if l.salida { l.params.get("Text").map(|v| v.txt()).unwrap_or_default() } else { String::new() }, l.params.get("Background color").map(|v| v.txt()).unwrap_or("Black".into())));
                    texto = Some(t.unwrap_or((String::new(), "Black".into())));
                }
                "SpawnPoint" => self.her.spawn = Some(pos),
                "Mover" | "LocalMover" | "LocalRotator" => {
                    let pid = num("Prop Id", 0.0) as u32;
                    let k = if pid != 0 { self.obj_por_id(pid) } else { Some(i) };
                    if let Some(k) = k { if on {
                        let o = &mut self.objs[k];
                        let (b0, q0, t0) = *o.log_base.get_or_insert((o.pos, o.q, 0.0)); let tt = t0 + dt * num("Speed", 1.0); o.log_base = Some((b0, q0, tt));
                        let local = tipo != "Mover"; let ax = if local { qrot32(q0, eje(&txt("Direction"))) } else { eje(&txt("Direction")) };
                        let (np, nq) = if tipo == "LocalRotator" {
                            let deg = num("Degree", 0.0); let ang = if deg != 0.0 { tt.sin() * deg.to_radians() } else { tt }; let s = (ang / 2.0).sin();
                            (b0, qmul32([ax[0] * s, ax[1] * s, ax[2] * s, (ang / 2.0).cos()], q0))
                        } else if tipo == "LocalMover" { let r = num("Range", 2.0) * tt.sin(); ([b0[0] + ax[0] * r, b0[1] + ax[1] * r, b0[2] + ax[2] * r], q0) }
                        else { let (a, b) = (p.get("Position A").map(|v| v.num()).unwrap_or(0.0), num("Position B", 4.0)); let kk = (tt.sin() + 1.0) / 2.0; let d = a + (b - a) * kk; ([b0[0] + ax[0] * d, b0[1] + ax[1] * d, b0[2] + ax[2] * d], q0) };
                        if let Some(cid) = o.cuerpo { if let Some(bd) = self.fis.cuerpo_mut(cid) { bd.congelado = true; bd.pos = [np[0] as f64, np[1] as f64, np[2] as f64]; bd.q = [nq[0] as f64, nq[1] as f64, nq[2] as f64, nq[3] as f64]; bd.actualizar(); bd.despertar(); } }
                        o.pos = np; o.q = nq; o.ant = (np, nq);
                    } }
                }
                "Spawner" => {
                    if on && lt > 1.0 {
                        if let Some(l) = self.objs[i].logica.as_mut() { l.t = 0.0; }
                        let d = num("Distance", 1.0); let up = qrot32(q, [0.0, d, 0.0]);
                        let nom = { let n = txt("Prop name"); if n.is_empty() { "Crate".to_string() } else { n } };
                        crear.push((nom, [pos[0] + up[0], pos[1] + up[1], pos[2] + up[2]], p.get("Kinematic").map(|v| v.si()).unwrap_or(false), num("Delete after", 1.0).max(0.3).max(1.0) * 5.0));
                    }
                }
                "Remover" => if on { let d = num("Distance", 3.0); for x in &self.objs { if x.id != id && x.logica.is_none() && dist(x.pos, pos) < d { borrar.push(x.id); } } },
                "Repulsor" => if on {
                    let (d, fz) = (num("Distance", 4.0), num("Force", 20.0)); let me = self.objs[i].cuerpo;
                    let cs: Vec<u32> = self.fis.cuerpos.iter().filter(|b| b.dinamico() && Some(b.id) != me).map(|b| b.id).collect();
                    for c in cs { if let Some(b) = self.fis.cuerpo_mut(c) { let v = [b.pos[0] as f32 - pos[0], b.pos[1] as f32 - pos[1], b.pos[2] as f32 - pos[2]]; let l = (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]).sqrt();
                        if l < d && l > 0.01 { b.despertar(); let k = fz * dt * 3.0 / l; for e in 0..3 { b.vel[e] += (v[e] * k) as f64; } } } }
                },
                _ => {}
            }
            if let Some(l) = self.objs[i].logica.as_mut() {
                if let Some(s) = nueva_salida { l.salida = s; }
                if let Some(x) = luz { l.luz = x; }
                if let Some((t, c)) = texto { l.texto = t; l.color = c; }
            }
        }
        for id in borrar { if let Some(i) = self.obj_por_id(id) { self.borrar_obj(i); } }
        let ahora = self.t0.elapsed().as_secs_f32();
        for (nom, p, kin, vida) in crear { if let Ok(Some(k)) = self.crear(m, &nom, p, [0.0, 0.0, 0.0, 1.0], false, kin) { let id = self.objs[k].id; self.her.tirados.push((id, ahora + vida)); } }
        let vencidos: Vec<u32> = self.her.tirados.iter().filter(|t| ahora > t.1).map(|t| t.0).collect();
        self.her.tirados.retain(|t| ahora <= t.1);
        for id in vencidos { if let Some(i) = self.obj_por_id(id) { self.borrar_obj(i); } }
        if let Some(c) = self.her.cable { if self.obj_por_id(c).is_none() { self.her.cable = None; } }
    }

    /// los cables (verdes con señal, azules sin), el que se está tendiendo y las trazas de la Tool Gun (dibujarHerramientas)
    pub(super) fn herramientas_items(&self, items: &mut Vec<jxmotor::escena::ItemDin>, luces: &mut Vec<[f32; 12]>) {
        for o in &self.objs {
            let Some(l) = &o.logica else { continue };
            for e in &l.entradas { if let Some(x) = self.objs.iter().find(|x| x.id == *e) { let on = x.logica.as_ref().map(|l| l.salida).unwrap_or(false); vista::tramo(x.pos, o.pos, 0.012, if on { vista::TUBO_VERDE } else { vista::TUBO_AZUL }, items); } }
            if l.tipo == "Lamp" && l.luz { luces.push([o.pos[0], o.pos[1] + 0.3, o.pos[2], l.params.get("Range").map(|v| v.num()).filter(|x| *x > 0.0).unwrap_or(10.0).max(4.0), 3.2, 2.8, 2.0, 0.0, 0.0, -1.0, 0.0, -2.0]); }
        }
        if let Some(c) = self.her.cable.and_then(|c| self.objs.iter().find(|o| o.id == c)) {
            let (oj, f) = (self.ojos_ult, self.mira());
            let fin = self.mapa.as_ref().and_then(|mp| mp.mundo.rayo(oj, f, 60.0)).map(|g| [oj[0] + f[0] * g.t, oj[1] + f[1] * g.t, oj[2] + f[2] * g.t]).unwrap_or([oj[0] + f[0] * 10.0, oj[1] + f[1] * 10.0, oj[2] + f[2] * 10.0]);
            vista::tramo(c.pos, fin, 0.012, vista::TUBO_AMARILLO, items);
        }
        for t in &self.her.trazas { vista::tramo(t.0, t.1, 0.008 * (t.2 / 0.12).max(0.2), vista::TUBO_AMARILLO, items); }
    }
}
