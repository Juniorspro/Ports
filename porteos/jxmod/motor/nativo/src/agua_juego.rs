//! El agua de partículas en el juego (jxjuego::fluido, como GWater pero propia) y los objetos huecos (flotar.rs): el
//! paso junto con la física (antes de flotar), el jugador y los NPC que la corren, las burbujas (de los huecos que se
//! llenan, de lo que cae al agua y del jugador que respira abajo del agua), el chorro de lo que se vuelca, los salpicones
//! de verdad en el agua de los mapas, las explosiones, la manguera y lo del menú Props → Agua.
use super::*;
use jxjuego::efectos::{Efectos, Tipo};
use jxjuego::fisica::Fisica;
use jxjuego::flotar::{Aguas, EventoHueco};
use jxjuego::fluido::{Capsula, Fluido};
use jxjuego::mundo::Mundo;

/// las cosas del menú Agua (clave, nombre, ícono)
pub const ITEMS: [(&str, &str, &str); 5] = [
    ("agua:balde", "Agua: un balde", "ico_agua_balde"),
    ("agua:pileta", "Agua: un montón", "ico_agua_pileta"),
    ("agua:canilla", "Canilla (30 s)", "ico_canilla"),
    ("agua:manguera", "Manguera", "ico_manguera"),
    ("agua:secar", "Secar todo", "ico_secar"),
];

#[derive(Default)]
pub struct Agua {
    pub flu: Fluido,
    /// la manguera prendida (tira agua hacia donde se mira)
    pub manguera: bool,
    ev: Vec<EventoHueco>,
    respira_t: f32, ruido_t: f32, sem: u32,
    /// las ondas nuevas (x, z, fuerza) y los ruidos (dónde, volumen) del último paso: los pone quien juega
    pub ondas: Vec<[f32; 3]>, pub ruidos: Vec<(V, f32)>,
    /// el agua de Source de los mapas
    pub src: AguaSrc,
}

/// el mapa de normales del agua de Source (dev/water_normal de Half-Life 2: 256 × 256, 29 cuadros), del archivo de Garry's
/// Mod 10 en archive.org (el mismo de donde salió gm_construct): se baja una vez, se guarda y desde ahí el agua de los mapas
/// es la de Source (su material: canales para gm_construct, la costa para los demás)
pub const URL_NORMAL_SRC: &str = "https://archive.org/download/garrys-mod-10/Garrys_Mod_10.rar/Garrys_Mod_10%2Fhl2%2Fmaterials%2Fdev%2Fwater_normal.vtf";
const TAM_NORMAL_SRC: usize = 10_136_388;
#[derive(Default)]
pub struct AguaSrc {
    /// los cuadros (ancho, alto, cuántos, RGBA uno abajo del otro)
    pub cuadros: Option<std::rc::Rc<(u32, u32, u32, Vec<u8>)>>,
    rx: Option<std::sync::mpsc::Receiver<Result<Vec<u8>, String>>>, pedida: bool, mirado: bool,
    /// el mapa al que ya se le puso
    pub puesta: Option<String>,
    pub error: Option<String>,
}
fn normal_src_de(b: &[u8]) -> Option<(u32, u32, u32, Vec<u8>)> {
    let cs = jxgmod::formatos::vtf_cuadros(b, 256).ok()?; let c0 = cs.first()?;
    if c0.w != c0.h || c0.w < 16 { return None; }
    let (w, h) = (c0.w as u32, c0.h as u32); let mut px = Vec::with_capacity(c0.w * c0.h * 4 * cs.len());
    for c in cs.iter().take(64) { px.extend_from_slice(&jxgmod::formatos::vtf_rgba(c)); }
    Some((w, h, cs.len().min(64) as u32, px))
}

impl Agua {
    fn azar(&mut self) -> f32 { self.sem = self.sem.wrapping_mul(1_664_525).wrapping_add(1_013_904_223); (self.sem >> 8) as f32 / 16_777_216.0 }
    /// una burbuja que sube hasta la superficie del agua del mapa (y ahí se termina); fuera del agua, nada
    pub fn burbuja(&mut self, ef: &mut Efectos, aguas: &Aguas, p: V, r: f32) {
        let Some(v) = aguas.en(p[0] as f64, p[1] as f64, p[2] as f64, 0.0) else { return };
        let sup = (v.y1 + v.ola_en(aguas.t, p[0] as f64, p[2] as f64)) as f32; if p[1] >= sup - 0.01 { return; }
        let sube = 0.22 + r * 14.0; let vida = ((sup - p[1]) / sube).clamp(0.05, 9.0);
        let lado = (self.azar() - 0.5) * 0.08;
        if let Some(pt) = ef.particula(p, [lado, sube, -lado], vida, r * 1.25, [0.86, 0.94, 1.0, 0.8], Tipo::Gota, 0.0) { pt.grav = 0.0; pt.tile = 3.0; pt.fr = 0.0; }
    }
    /// un chorro de n partículas desde p hacia dir (de largo 1) a vel m/s, abierto en un disco chico
    pub fn chorro(&mut self, p: V, dir: V, vel: f32, n: usize) {
        let up = if dir[1].abs() > 0.9 { [1.0, 0.0, 0.0] } else { [0.0, 1.0, 0.0] };
        let a = cruz(dir, up); let la = largo(a).max(1e-6); let a = esc(a, 1.0 / la); let b = cruz(dir, a);
        for k in 0..n {
            let (u, w) = (self.azar() - 0.5, self.azar() - 0.5); let r = if k == 0 { 0.0 } else { 0.06 };
            let q = add(p, add(esc(a, u * r * 2.0), esc(b, w * r * 2.0)));
            let v = add(esc(dir, vel * (0.92 + 0.16 * self.azar())), add(esc(a, u * 0.6), esc(b, w * 0.6)));
            self.flu.agregar(q, v);
        }
    }
}

/// el paso del agua, dentro del bucle de la física (antes de flotar y de `Fisica::paso`): los huecos (se llenan, vuelcan,
/// largan burbujas), la manguera, el fluido con el jugador y los NPC, lo que entra a los baldes, lo que cae al agua del
/// mapa (ondas y ruido) y las burbujas del que respira abajo del agua
#[allow(clippy::too_many_arguments)]
pub fn agua_paso(a: &mut Agua, fis: &mut Fisica, aguas: &mut Aguas, ef: &mut Efectos, mundo: &Mundo, caps: &[Capsula], mano: (V, V), ojos: V, grav: f32, dt: f32) {
    a.ondas.clear(); a.ruidos.clear();
    // los huecos
    let mut ev = std::mem::take(&mut a.ev); ev.clear();
    aguas.huecos(fis, dt as f64, &mut ev);
    for e in &ev {
        match *e {
            EventoHueco::Burbuja { p, r } => a.burbuja(ef, aguas, [p[0] as f32, p[1] as f32, p[2] as f32], r as f32),
            EventoHueco::Gota { p, v } => {
                let (p, v) = ([p[0] as f32, p[1] as f32, p[2] as f32], [v[0] as f32, v[1] as f32, v[2] as f32]);
                let tam = 0.012 + a.azar() * 0.018;
                if let Some(pt) = ef.particula(p, v, 0.9, tam, [0.62, 0.78, 0.9, 0.75], Tipo::Gota, 0.0) { pt.tile = 0.0; }
            }
            EventoHueco::Agua { p, v } => { a.flu.agregar([p[0] as f32, p[1] as f32, p[2] as f32], [v[0] as f32, v[1] as f32, v[2] as f32]); }
        }
    }
    a.ev = ev;
    // la manguera: desde la mano hacia donde se mira
    if a.manguera { let (o, d) = mano; let der = { let c = cruz(d, [0.0, 1.0, 0.0]); let l = largo(c).max(1e-6); esc(c, 1.0 / l) }; a.chorro(add(add(o, esc(d, 1.0)), esc(der, -0.22)), d, 10.0, 4); }
    // el fluido
    let bocas = aguas.bocas(fis);
    a.flu.paso(dt, grav, mundo, fis, Some(aguas), caps, &bocas);
    for (id, v) in std::mem::take(&mut a.flu.llenados) { aguas.llenar(id, v); }
    // lo que cayó al agua del mapa: ondas (las más fuertes) y ruido (no más de uno cada 0,12 s)
    a.ruido_t -= dt;
    let mut mejor: Option<(V, f32)> = None;
    for &(p, v) in &a.flu.absorbidas { if v > 1.5 && mejor.map_or(true, |m| v > m.1) { mejor = Some((p, v)); } }
    if let Some((p, v)) = mejor {
        if a.ruido_t <= 0.0 { a.ruido_t = 0.12; a.ruidos.push((p, (v / 10.0).clamp(0.08, 0.5))); a.ondas.push([p[0], p[2], (v / 12.0).clamp(0.15, 0.7)]); }
        // (lo que cae fuerte mete aire: unas burbujas)
        for _ in 0..(v as usize / 3).min(3) { let j = [(a.azar() - 0.5) * 0.3, -0.05 - a.azar() * 0.3, (a.azar() - 0.5) * 0.3]; let r = 0.006 + a.azar() * 0.01; a.burbuja(ef, aguas, add(p, j), r); }
    }
    // el que respira abajo del agua: cada 2 a 3 s, unas burbujas
    a.respira_t -= dt;
    if a.respira_t <= 0.0 {
        a.respira_t = 2.0 + a.azar();
        if let Some(v) = aguas.en(ojos[0] as f64, ojos[1] as f64, ojos[2] as f64, 0.0) { if (ojos[1] as f64) < v.y1 - 0.05 {
            for k in 0..(3 + (a.azar() * 4.0) as usize) { let p = [ojos[0] + (a.azar() - 0.5) * 0.06, ojos[1] - 0.08 - k as f32 * 0.03, ojos[2] + (a.azar() - 0.5) * 0.06]; let r = 0.004 + a.azar() * 0.008; a.burbuja(ef, aguas, p, r); }
        } }
    }
}

impl Juego {
    /// el agua de Source: la textura (del archivo guardado o bajándola una vez) y, cuando está, el agua del mapa con su
    /// material de Source (una vez por mapa). Cada cuadro, con el mapa puesto
    pub(crate) fn agua_src_paso(&mut self, m: &mut Motor3d) {
        if std::env::var_os("JXM_SIN_AGUA_SRC").is_some() { return; }
        let archivo = self.datos.as_ref().map(|d| d.join("hl2_water_normal.vtf"));
        let src = &mut self.jg.agua.src;
        if src.cuadros.is_none() {
            if !src.mirado { src.mirado = true; if let Some(b) = archivo.as_ref().and_then(|f| std::fs::read(f).ok()).filter(|b| b.len() == TAM_NORMAL_SRC) { src.cuadros = normal_src_de(&b).map(std::rc::Rc::new); } }
            if src.cuadros.is_none() && !src.pedida && self.mapa.as_ref().map_or(false, |mp| mp.esc.c.agua.is_some()) {
                if let Some(h) = self.gmod_http_bin() {
                    let src = &mut self.jg.agua.src; src.pedida = true;
                    let (tx, rx) = std::sync::mpsc::channel(); src.rx = Some(rx);
                    std::thread::spawn(move || { let r = h(URL_NORMAL_SRC).and_then(|(c, b)| if c == 200 && b.len() == TAM_NORMAL_SRC { Ok(b) } else { Err(format!("HTTP {c}, {} bytes", b.len())) }); let _ = tx.send(r); });
                }
            }
            let src = &mut self.jg.agua.src;
            if let Some(r) = src.rx.as_ref().and_then(|rx| rx.try_recv().ok()) {
                src.rx = None;
                match r { Ok(b) => { if let Some(f) = &archivo { let _ = std::fs::write(f, &b); } src.cuadros = normal_src_de(&b).map(std::rc::Rc::new); if src.cuadros.is_none() { src.error = Some("la textura no se pudo leer".into()); } }
                    Err(e) => src.error = Some(e) }
            }
        }
        // (ponerla en el agua del mapa: los cuadros y lo hondo —de los datos del mapa— en una escena con sólo el agua)
        let Some(cs) = self.jg.agua.src.cuadros.clone() else { return };
        let Some(mp) = self.mapa.as_ref() else { return };
        if self.jg.agua.src.puesta.as_deref() == Some(mp.nombre.as_str()) { return; }
        // (los mapas de Source de los addons ya traen el agua de su material: queda la suya)
        let Some(mut a) = mp.esc.c.agua.clone().filter(|a| a.fuente == 0) else { self.jg.agua.src.puesta = Some(mp.nombre.clone()); return };
        let mut datos = Vec::with_capacity(cs.3.len() + 64 * 64 * 4);
        datos.extend_from_slice(&cs.3);
        if let Some(t) = a.prof.as_mut().and_then(|p| p.tex.as_mut()) {
            let n = (t.w * t.h * 4) as usize; let Some(px) = mp.esc.datos.get(t.o..t.o + n) else { return };
            while datos.len() % 4 != 0 { datos.push(0); } t.o = datos.len(); datos.extend_from_slice(px);
        }
        jxjuego::mapa::agua_source(&mut a, &jxjuego::mapa::mat_agua_source(&mp.nombre), cs.0, cs.1, cs.2, 0);
        let cab = Cabecera { mapa: String::new(), w: 0, h: 0, cam: None, luz: None, mallas: vec![], mats: vec![], texs: vec![], lms: vec![], items: vec![], agua: Some(a), cielo: None };
        let nombre = mp.nombre.clone();
        match unsafe { m.cargar(&Escena { c: cab, datos }) } { Ok(()) => self.jg.agua.src.puesta = Some(nombre), Err(e) => { self.jg.agua.src.error = Some(e); self.jg.agua.src.puesta = Some(nombre); } }
    }
    /// Props → Agua: poner agua donde se mira (sobre la superficie), una canilla, la manguera o secar todo
    pub fn agua_poner(&mut self, k: &str) -> bool {
        let Some(mp) = self.mapa.as_ref() else { return true };
        let (ojos, fw) = (self.ojos_ult, self.mira());
        // (dónde se mira: el punto de la superficie y su normal; si no hay nada cerca, 4 m adelante)
        let (o64, d64) = ([ojos[0] as f64, ojos[1] as f64, ojos[2] as f64], [fw[0] as f64, fw[1] as f64, fw[2] as f64]);
        let golpe = self.fis.rayo(&mp.mundo, o64, d64, 30.0, &[]);
        let (p, n) = match golpe { Some(g) => ([ojos[0] + fw[0] * g.t as f32, ojos[1] + fw[1] * g.t as f32, ojos[2] + fw[2] * g.t as f32], [g.n[0] as f32, g.n[1] as f32, g.n[2] as f32]), None => (add(ojos, esc(fw, 4.0)), [0.0, 1.0, 0.0]) };
        self.jg.agua.flu.calidad(self.aj.calidad as usize);
        match k {
            "balde" | "pileta" => {
                let (nx, ny) = if k == "balde" { (6, 6) } else { (11, 9) };
                // (la base apoyada en la superficie; contra una pared, separada de ella)
                let lado = nx as f32 * jxjuego::fluido::ESPACIO;
                let base = if n[1] > 0.5 { add(p, [0.0, 0.02, 0.0]) } else { let c = add(p, esc(n, lado * 0.5 + 0.08)); [c[0], c[1] - lado * 0.5, c[2]] };
                let puestas = self.jg.agua.flu.bloque(base, nx, ny, nx, [0.0; 3]);
                self.avisar(format!("Agua: {puestas} partículas ({} L)", puestas));
            }
            "canilla" => {
                let alto = if n[1] > 0.5 { 1.6 } else { 0.2 };
                let q = add(p, esc(n, alto)); let dir = if n[1] > 0.5 { [0.0, -1.0, 0.0] } else { n };
                self.jg.agua.flu.fuente(q, dir, 3.0, 150.0, 30.0);
                self.avisar("Canilla: 30 s de agua".into());
            }
            "manguera" => { self.jg.agua.manguera = !self.jg.agua.manguera; self.avisar(if self.jg.agua.manguera { "Manguera: prendida (tira hacia donde mirás)".into() } else { "Manguera: apagada".into() }); }
            "secar" => { let n = self.jg.agua.flu.cuantas(); self.jg.agua.flu.limpiar(); self.jg.agua.manguera = false; self.avisar(format!("Secado: {n} partículas")); }
            _ => {}
        }
        true
    }
    /// las cápsulas que corren el agua: el jugador (si no vuela) y los NPC vivos
    pub(crate) fn agua_capsulas(&self) -> Vec<Capsula> {
        let mut c = vec![];
        if !self.jug.noclip && self.vehs.jugador.is_none() {
            let p = self.jug.pos; let pie = p[1] - self.jug.medio - self.jug.radio; c.push(Capsula { a: [p[0], pie + 0.26, p[2]], b: [p[0], p[1] + 0.55, p[2]], r: 0.26, v: self.jug.vel });
        } else { c.push(Capsula { a: [0.0, -1e6, 0.0], b: [0.0, -1e6, 0.0], r: 0.0, v: [0.0; 3] }); }
        for n in self.npcs.lista.iter().filter(|n| n.vivo).take(24) {
            let p = n.pos(); let p = [p[0] as f32, p[1] as f32, p[2] as f32];
            c.push(Capsula { a: [p[0], p[1] - 0.4, p[2]], b: [p[0], p[1] + 0.9, p[2]], r: 0.3, v: [n.cap.vel[0] as f32, n.cap.vel[1] as f32, n.cap.vel[2] as f32] });
        }
        c
    }
    /// el bloque que se dibuja (EF_FLUIDO), con la luz del cuadro
    pub(crate) fn agua_bloque(&self, ef: &mut Vec<(u32, Vec<f32>)>, vp: &M4, cam: V, luz: &jxmotor::escena::Luz) {
        if self.jg.agua.flu.cuantas() == 0 { return; }
        // (la derecha y el arriba de la cámara, de la matriz)
        let der = { let l = largo([vp[0], vp[4], vp[8]]).max(1e-6); [vp[0] / l, vp[4] / l, vp[8] / l] };
        let arr = { let l = largo([vp[1], vp[5], vp[9]]).max(1e-6); [vp[1] / l, vp[5] / l, vp[9] / l] };
        // (los colores como los del humo: con la luz del momento; el agua un poco verde azulada, el cielo para el reflejo)
        let l = self.ef.luz;
        let agua = [0.16 * l[0], 0.34 * l[1], 0.42 * l[2], 0.34];
        let cielo = [0.62 * l[0] + 0.1, 0.74 * l[1] + 0.1, 0.86 * l[2] + 0.12, 1.0];
        let s = luz.sol; let ls = largo(s).max(1e-6); let brillo = (luz.sol_c[0] + luz.sol_c[1] + luz.sol_c[2]) / 3.0;
        let sol = [s[0] / ls, s[1] / ls, s[2] / ls, (brillo * 0.9).clamp(0.0, 2.0)];
        let lejos = if self.aj.calidad >= 4 { 120.0 } else { 70.0 };
        let b = self.jg.agua.flu.bloque_dibujo(cam, der, arr, lejos, agua, cielo, sol);
        if b[1] > 0.0 { ef.push((jxmotor::escena::EF_FLUIDO, b)); }
    }
}
