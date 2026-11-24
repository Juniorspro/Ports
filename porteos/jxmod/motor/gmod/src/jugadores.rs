//! Los modelos de jugador de GMod y sus manos (player_manager de gmod_api.js y las funciones gmvRutaMdl, gmvPmNombre,
//! gmvManosDeNombre, gmvManosDeModelo y gmvManosJugador de gmod_vista.js): lo que registran los addons con
//! player_manager.AddValidModel y AddValidHands, los de GMod (GMV_PM_BASE: nombre → modelo y manos c_arms con su piel y
//! sus cuerpos) y las manos que lleva el jugador según el modelo que tiene puesto (las armas c_ las pegan a la vista).

use crate::nucleo::*;
use jxlua::{Estado, Valor};

/// los modelos de jugador de GMod: «nombre modelo manos piel cuerpo» (GMV_PM_BASE; las manos: c citizen, r refugee,
/// b combine, s cstrike, h chell, d dod; sin manos, las de por defecto)
const PM_BASE: &str = "alyx alyx c 0 0,breen breen c 0 0,eli eli c 1 0,gman gman_high c 0 0,kleiner kleiner c 0 0,monk monk c 0 0,odessa odessa c 0 0,barney barney b 0 0,\
magnusson magnusson c 0 0,mossman mossman c 0 0,mossmanarctic mossman_arctic c 0 1,combine combine_soldier b 0 0,combineprison combine_soldier_prisonguard b 0 0,\
combineelite combine_super_soldier b 0 0,police police b 0 0,policefem police_fem b 0 0,stripped soldier_stripped c 0 0,charple charple c 2 0,corpse corpse1 c 2 0,\
skeleton skeleton c 2 0,zombie zombie_classic c 2 0,zombiefast zombie_fast c 2 0,zombine zombie_soldier b 0 0,female01 group01/female_01 c 0 0,female02 group01/female_02 c 0 0,\
female03 group01/female_03 c 1 0,female04 group01/female_04 c 0 0,female05 group01/female_05 c 1 0,female06 group01/female_06 c 0 0,female07 group03/female_01 r 0 1,\
female08 group03/female_02 r 0 1,female09 group03/female_03 r 1 1,female10 group03/female_04 r 0 1,female11 group03/female_05 r 1 1,female12 group03/female_06 r 0 1,\
male01 group01/male_01 c 1 0,male02 group01/male_02 c 0 0,male03 group01/male_03 c 1 0,male04 group01/male_04 c 0 0,male05 group01/male_05 c 0 0,male06 group01/male_06 c 0 0,\
male07 group01/male_07 c 0 0,male08 group01/male_08 c 0 0,male09 group01/male_09 c 0 0,male10 group03/male_01 r 1 1,male11 group03/male_02 r 0 0,male12 group03/male_03 r 1 0,\
male13 group03/male_04 r 0 1,male14 group03/male_05 r 0 1,male15 group03/male_06 r 0 1,male16 group03/male_07 r 0 1,male17 group03/male_08 r 0 0,male18 group03/male_09 r 0 1,\
medic01 group03m/male_01 r 1 1,medic02 group03m/male_02 r 0 0,medic03 group03m/male_03 r 1 1,medic04 group03m/male_04 r 0 0,medic05 group03m/male_05 r 0 1,\
medic06 group03m/male_06 r 0 0,medic07 group03m/male_07 r 0 0,medic08 group03m/male_08 r 0 0,medic09 group03m/male_09 r 0 0,medic10 group03m/female_01 r 0 1,\
medic11 group03m/female_02 r 0 0,medic12 group03m/female_03 r 1 0,medic13 group03m/female_04 r 0 1,medic14 group03m/female_05 r 0 1,medic15 group03m/female_06 r 1 1,\
refugee01 group02/male_02 c 0 0,refugee02 group02/male_04 c 0 0,refugee03 group02/male_06 c 0 0,refugee04 group02/male_08 c 0 0,hostage01 hostage/hostage_01,\
hostage02 hostage/hostage_02,hostage03 hostage/hostage_03,hostage04 hostage/hostage_04,css_arctic arctic s 0 0,css_gasmask gasmask s 0 0,css_guerilla guerilla s 0 0,\
css_leet leet s 0 0,css_phoenix phoenix s 0 0,css_riot riot s 0 0,css_swat swat s 0 0,css_urban urban s 0 0,chell p2_chell h 0 0,dod_german dod_german d 0 0,dod_american dod_american d 1 0";

/// las manos por defecto (GMV_MANOS_DEF)
pub fn manos_def() -> ManosPm { ManosPm { model: "models/weapons/c_arms_citizen.mdl".into(), skin: 0.0, body: "100000000".into(), match_body_skin: false } }

/// GMV_PM_BASE: (nombre, modelo, manos)
pub fn pm_base() -> Vec<(String, String, Option<ManosPm>)> {
    PM_BASE.split(',').map(|x| {
        let p: Vec<&str> = x.split(' ').collect();
        let manos = p.get(2).map(|h| {
            let c = match *h { "c" => "citizen", "r" => "refugee", "b" => "combine", "s" => "cstrike", "h" => "chell", _ => "dod" };
            ManosPm { model: format!("models/weapons/c_arms_{c}.mdl"), skin: p.get(3).and_then(|s| s.parse().ok()).unwrap_or(0.0), body: if p.get(4) == Some(&"1") { "0100000".into() } else { "0000000".into() }, match_body_skin: false }
        });
        (p[0].to_string(), format!("models/player/{}.mdl", p.get(1).copied().unwrap_or("kleiner")), manos)
    }).collect()
}

/// gmvRutaMdl: en minúsculas, con / y con models/ adelante
pub fn ruta_mdl(m: &str) -> String {
    let r = m.to_lowercase().replace('\\', "/"); let r = r.trim_start_matches('/').to_string();
    if !r.is_empty() && !r.starts_with("models/") { format!("models/{r}") } else { r }
}
/// gmvPmNombre (TranslateToPlayerModelName): el nombre con que lo registró su addon, el de GMod o «kleiner»
pub fn pm_nombre(m: &str) -> String {
    let r = ruta_mdl(m);
    // (GMA.pmNombres: el último registro de esa ruta gana, como un Map que se pisa)
    if let Some(n) = g(|g| g.pmodels.iter().rev().find(|(_, x)| ruta_mdl(x) == r).map(|x| x.0.clone())) { return n; }
    pm_base().into_iter().find(|x| x.1 == r).map(|x| x.0).unwrap_or_else(|| "kleiner".into())
}
/// gmvManosDeNombre (TranslatePlayerHands)
pub fn manos_de_nombre(n: &str) -> ManosPm {
    if let Some(a) = g(|g| g.pmanos.iter().rev().find(|x| x.0 == n).map(|x| x.1.clone())) { return a; }
    pm_base().into_iter().find(|x| x.0 == n).and_then(|x| x.2).unwrap_or_else(manos_def)
}
/// gmvManosDeModelo: las de su nombre y, si no hay, las que su addon registró con otro nombre para ese modelo (el de
/// AddValidModel con otra mayúscula, o el nombre del archivo)
pub fn manos_de_modelo(m: &str) -> ManosPm {
    let r = ruta_mdl(m); let n = pm_nombre(&r);
    let (manos, pmodels) = g(|g| (g.pmanos.clone(), g.pmodels.clone()));
    if let Some(h) = manos.iter().rev().find(|x| x.0 == n) { return h.1.clone(); }
    if !manos.is_empty() {
        let mut alias = vec![n.clone()];
        for (k, x) in &pmodels { if ruta_mdl(x) == r { alias.push(k.clone()); } }
        alias.push(r.rsplit('/').next().unwrap_or(&r).trim_end_matches(".mdl").to_string());
        for a in &alias { if let Some(h) = manos.iter().find(|x| x.0.to_lowercase() == a.to_lowercase()) { return h.1.clone(); } }
    }
    manos_de_nombre(&n)
}
/// ¿un modelo de jugador trae sus propias manos? (gmvPmTieneManos)
pub fn pm_tiene_manos(m: &str) -> bool {
    let a = manos_de_modelo(m); let d = manos_def();
    a != d && ruta_mdl(&a.model) != d.model && existe(&ruta_mdl(&a.model))
}
/// las manos del jugador de ahora (gmvManosJugador, sin el tinte de los personajes del juego): las que puso el Lua con
/// GetHands():SetModel, las del modelo de un addon que tiene puesto o las de ciudadano
pub fn manos_jugador() -> ManosPm {
    if let Some(he) = g(|g| g.manos_ent.clone()) {
        if let Some((vivo, m, sk)) = ce(&he, |x| (x.vivo, x.modelo.clone(), num(&x.skin, 0.0))) {
            let ov = ruta_mdl(&m);
            if vivo && !m.is_empty() && existe(&ov) { return ManosPm { model: ov, skin: sk.max(0.0), body: "0000000".into(), match_body_skin: false }; }
        }
    }
    let r = g(|g| g.modelo_jug.clone()).to_lowercase();
    if !r.is_empty() && !r.starts_with("jxpj/") {
        let h = manos_de_modelo(&r); let model = { let x = ruta_mdl(&h.model); if x.is_empty() { manos_def().model } else { x } };
        return ManosPm { model, skin: h.skin.max(0.0), body: h.body, match_body_skin: h.match_body_skin };
    }
    ManosPm { model: manos_def().model, skin: 0.0, body: "0000000".into(), match_body_skin: false }
}

/// player_manager: AddValidModel, AddValidHands, TranslatePlayerModel, AllValidModels, TranslateToPlayerModelName y
/// TranslatePlayerHands (como gmod_api.js)
pub(crate) fn instalar(e: &mut Estado) {
    let gl = e.globales(); let pmg = match gl.borrow().get_str("player_manager") { Valor::Tabla(t) => t, _ => return };
    def(&pmg, "AddValidModel", |_, a, _| {
        let (n, m) = (ar(a, 0), ar(a, 1));
        if let (Valor::Cad(_), Valor::Cad(_)) = (&n, &m) { let (n, m) = (js_str(&n), js_str(&m)); g(|g| { g.pmodels.retain(|x| x.0 != n); g.pmodels.push((n, m)); g.pm_v += 1; }); }
        Ok(())
    });
    def(&pmg, "AddValidHands", |_, a, _| {
        let (n, m) = (ar(a, 0), ar(a, 1));
        if n.es_nil() || !matches!(m, Valor::Cad(_)) { return Ok(()); }
        let b = ar(a, 3); let body = if b.es_nil() { "0000000".to_string() } else { js_str(&b) };
        let h = ManosPm { model: js_str(&m), skin: num(&ar(a, 2), 0.0), body, match_body_skin: ar(a, 4).es_verdad() };
        let n = js_str(&n); g(|g| { g.pmanos.retain(|x| x.0 != n); g.pmanos.push((n, h)); g.pm_v += 1; });
        Ok(())
    });
    def(&pmg, "TranslatePlayerModel", |_, a, o| {
        let n = js_str(&ar(a, 0));
        let m = g(|g| g.pmodels.iter().rev().find(|x| x.0 == n).map(|x| x.1.clone())).or_else(|| pm_base().into_iter().find(|x| x.0 == n).map(|x| x.1)).unwrap_or_else(|| "models/player/kleiner.mdl".into());
        o.push(cad(&m)); Ok(())
    });
    def(&pmg, "AllValidModels", |_, _, o| {
        let t = jxlua::Tabla::nueva_ref();
        for (n, m, _) in pm_base() { t.borrow_mut().set_str(&n, cad(&m)); }
        for (n, m) in g(|g| g.pmodels.clone()) { t.borrow_mut().set_str(&n, cad(&m)); }
        o.push(Valor::Tabla(t)); Ok(())
    });
    def(&pmg, "TranslateToPlayerModelName", |_, a, o| { o.push(cad(&pm_nombre(&js_str(&ar(a, 0))))); Ok(()) });
    def(&pmg, "TranslatePlayerHands", |_, a, o| {
        let h = manos_de_nombre(&js_str(&ar(a, 0)));
        o.push(tabla_kv(vec![("model", cad(&h.model)), ("skin", Valor::Num(h.skin)), ("body", cad(&h.body)), ("matchBodySkin", Valor::Bool(h.match_body_skin))])); Ok(())
    });
}
