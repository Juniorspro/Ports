//! Las bibliotecas de GMod (gmaApiLibs de la web): globales, ents, player, game, engine, util, timer, hook, concommand,
//! cvars, net, umsg, sound, los objetos de efectos, daño y partículas, include/require y correr un archivo.

use crate::anfitrion::*;
use crate::mates::*;
use crate::motor::*;
use crate::nucleo::*;
use crate::valores::{color, colorf, vx};
use jxlua::{Error, Estado, Tabla, TablaRef, Udata, Valor};
use std::cell::RefCell;
use std::rc::Rc;

type R = Result<(), Error>;
/// (un nil que devuelve una función de la web es «undefined»: no es ningún valor, como E0)
fn ok1(o: &mut Vec<Valor>, v: Valor) -> R { if !v.es_nil() { o.push(v); } Ok(()) }
fn b(o: &mut Vec<Valor>, x: bool) -> R { o.push(Valor::Bool(x)); Ok(()) }
fn n(o: &mut Vec<Valor>, x: f64) -> R { o.push(Valor::Num(x)); Ok(()) }
fn s(o: &mut Vec<Valor>, x: &str) -> R { o.push(cad(x)); Ok(()) }
fn tnueva() -> Valor { Valor::Tabla(Tabla::nueva_ref()) }
fn tiempo() -> f64 { h(|h| h.tiempo()) }
fn ctx() -> Lado { g(|g| g.ctx) }
fn unir(e: &mut Estado, a: &[Valor], sep: &[u8]) -> Result<Vec<u8>, Error> {
    let mut v = Vec::new();
    for (i, x) in a.iter().enumerate() { if i > 0 { v.extend_from_slice(sep); } v.extend_from_slice(e.tostring(x)?.bytes()); }
    Ok(v)
}

// ---------------- cvars ----------------
pub(crate) fn cvar_motor(n: &str) -> Option<String> {
    let n = n.to_lowercase();
    let v = match n.as_str() {
        "sv_gravity" => "600", "sv_cheats" => "0", "sv_allowcslua" => "0", "host_timescale" => "1", "phys_timescale" => "1", "skill" => "1", "developer" => "0", "deathmatch" => "1", "coop" => "0", "maxplayers" => "8", "hostname" => "JXMod",
        "sv_defaultdeployspeed" => "4", "sv_friction" => "8", "sv_accelerate" => "10", "sv_airaccelerate" => "10", "sv_maxvelocity" => "3500", "sv_noclipspeed" => "5", "sv_stepsize" => "18", "sv_footsteps" => "1", "mp_falldamage" => "0", "mp_friendlyfire" => "0", "mp_flashlight" => "1",
        "ai_disabled" => "0", "ai_ignoreplayers" => "0", "ai_serverragdolls" => "1", "gmod_physiterations" => "4", "gmod_maxammo" => "9999", "gmod_suit" => "0", "gmod_language" => "en", "gmod_toolmode" => "", "gmod_drawhelp" => "1", "gmod_drawtooleffects" => "1", "gmod_mcore_test" => "0",
        "sbox_godmode" => "0", "sbox_noclip" => "1", "sbox_playershurtplayers" => "1", "sbox_weapons" => "1", "sbox_bonemanip_npc" => "1", "sbox_bonemanip_player" => "0", "sbox_bonemanip_misc" => "0", "sbox_persist" => "", "sbox_maxprops" => "150", "sbox_maxragdolls" => "10", "sbox_maxvehicles" => "4",
        "sbox_maxeffects" => "200", "sbox_maxballoons" => "100", "sbox_maxcameras" => "10", "sbox_maxnpcs" => "10", "sbox_maxsents" => "100", "sbox_maxdynamite" => "10", "sbox_maxlamps" => "3", "sbox_maxlights" => "5", "sbox_maxwheels" => "50", "sbox_maxthrusters" => "50", "sbox_maxhoverballs" => "50",
        "sbox_maxbuttons" => "50", "sbox_maxemitters" => "20", "sbox_maxconstraints" => "2000", "sbox_maxropeconstraints" => "1000", "cl_drawhud" => "1", "cl_interp" => "0.1", "cl_showfps" => "0", "fov_desired" => "75", "viewmodel_fov" => "54", "sensitivity" => "3", "volume" => "1", "cl_playermodel" => "kleiner",
        "cl_playercolor" => "0.24 0.34 0.41", "cl_weaponcolor" => "0.30 1.80 2.10", "cl_playerskin" => "0", "cl_playerbodygroups" => "0", "name" => "Jugador", "mat_fullbright" => "0", "r_drawviewmodel" => "1", "gmod_mcore" => "0", "net_graph" => "0", "cl_new_impact_effects" => "0",
        "sv_skyname" => "painted", "sv_lan" => "0", "sv_tags" => "", "sv_password" => "", "sv_alltalk" => "1", "sv_timeout" => "65", "sv_allowupload" => "1", "sv_allowdownload" => "1", "sv_downloadurl" => "", "sv_loadingurl" => "", "sv_noclipaccelerate" => "5", "sv_specspeed" => "3", "sv_rollangle" => "0", "sv_rollspeed" => "200", "sv_bounce" => "0", "sv_wateraccelerate" => "10", "sv_waterfriction" => "1", "sv_stopspeed" => "10", "sv_backspeed" => "0.6", "sv_maxspeed" => "320", "sv_kickerrornum" => "0", "sv_minrate" => "3500", "sv_maxrate" => "0", "sv_region" => "-1", "sv_playerpickupallowed" => "1", "sv_robust_explosions" => "1", "sv_hl2mp_weapon_respawn_time" => "20", "sv_hl2mp_item_respawn_time" => "30", "gamemode" => "sandbox", "mp_timelimit" => "0", "mp_fraglimit" => "0", "mp_forcerespawn" => "1", "mp_teamplay" => "0", "mp_show_voice_icons" => "1", "mp_decals" => "200", "phys_pushscale" => "1", "phys_impactforcescale" => "1", "phys_speeded" => "1", "physgun_maxrange" => "4096", "physgun_limited" => "0", "gmod_physgun_maxspeed" => "4000", "gmod_vehicle_viewmode" => "0", "gmod_admin_cleanup" => "1", "gmod_npcweapon" => "", "net_maxfilesize" => "64", "voice_enable" => "1", "voice_scale" => "1",
        "mat_dxlevel" => "95", "mat_hdr_level" => "2", "mat_picmip" => "0", "mat_specular" => "1", "mat_bumpmap" => "1", "mat_motion_blur_enabled" => "0", "mat_monitorgamma" => "2.2", "r_shadows" => "1", "r_3dsky" => "1", "r_decals" => "2048", "r_drawparticles" => "1", "r_drawentities" => "1", "r_drawworld" => "1", "r_dynamic" => "1", "r_lod" => "-1", "r_rootlod" => "0", "r_waterforceexpensive" => "0", "r_eyes" => "1", "r_teeth" => "1", "r_flex" => "1", "r_radiosity" => "3", "r_farz" => "-1", "cl_cmdrate" => "30", "cl_updaterate" => "30", "rate" => "30000", "cl_righthand" => "1", "cl_bob" => "0.002", "cl_bobcycle" => "0.8", "cl_bobup" => "0.5", "cl_detaildist" => "1200", "cl_drawownshadow" => "0", "cl_ragdoll_collide" => "0", "cl_forwardspeed" => "10000", "cl_sidespeed" => "10000", "cl_backspeed" => "10000", "cl_yawspeed" => "210", "cl_pitchspeed" => "225", "hud_fastswitch" => "0", "hud_draw" => "1", "crosshair" => "1", "hud_quickinfo" => "1", "m_pitch" => "0.022", "m_yaw" => "0.022", "joystick" => "0", "snd_mute_losefocus" => "1", "cl_showhints" => "1", "closecaption" => "0", "cc_lang" => "", "gmod_sneak_attack" => "1", "sv_infinite_aux_power" => "0", "hostport" => "27015", "ip" => "127.0.0.1", "sv_hibernate_think" => "0",
        _ => { return if n.starts_with("sbox_max") { Some("100".into()) } else { None }; }
    };
    Some(v.to_string())
}
/// un ConVar de Lua
pub(crate) struct CvarRef(pub Rc<RefCell<Cvar>>);
/// gmaCvar: la variable (la crea con su valor por defecto si no está)
pub(crate) fn cvar(n: &str, d: Option<String>, hv: Valor, mn: Valor, mx: Valor) -> Valor {
    let d = match d { Some(d) if (n.to_lowercase().ends_with("_spawn_protect") || n.to_lowercase().ends_with("_spawnprotect") || n.to_lowercase().ends_with("_spawn_protection") || n.to_lowercase().ends_with("_spawnprotection")) && d == "1" => Some("0".to_string()), x => x };
    let c = g(|g| {
        g.cvars.entry(n.to_string()).or_insert_with(|| {
            let dv = d.clone().unwrap_or_else(|| "0".into());
            Rc::new(RefCell::new(Cvar { n: n.to_string(), v: dv.clone(), d: dv, h: if js_t(&hv) { hv.clone() } else { cad("") }, mn: None, mx: None, cbs: Vec::new() }))
        }).clone()
    });
    { let mut x = c.borrow_mut(); if let (Valor::Num(m), None) = (&mn, x.mn) { x.mn = Some(*m); } if let (Valor::Num(m), None) = (&mx, x.mx) { x.mx = Some(*m); } }
    let mt = g(|g| g.mt.cvar.clone());
    Valor::Udata(Udata::nueva(CvarRef(c), mt))
}
fn cv(v: &Valor) -> Option<Rc<RefCell<Cvar>>> { match v { Valor::Udata(u) => u.con(|c: &CvarRef| c.0.clone()), _ => None } }
fn cv_hay(n: &str) -> bool {
    if g(|g| g.cvars.contains_key(n)) { return true; }
    match cvar_motor(n) { Some(d) => { cvar(n, Some(d), Valor::Nil, Valor::Nil, Valor::Nil); true } None => false }
}
fn cv_num(c: &Rc<RefCell<Cvar>>) -> f64 { let v = cad(&c.borrow().v); Estado::a_numero(&v).unwrap_or(0.0) }
/// la metatabla de los ConVar (la misma de FindMetaTable("ConVar"))
pub(crate) fn mt_cvar() -> TablaRef {
    if let Some(m) = g(|g| g.mt.cvar.clone()) { return m; }
    let m = Tabla::nueva_ref();
    m.borrow_mut().set_str("__index", Valor::Tabla(m.clone()));
    m.borrow_mut().set_str("MetaName", cad("ConVar"));
    def(&m, "GetInt", |_, a, o| n(o, cv(&ar(a, 0)).map(|c| cv_num(&c).trunc()).unwrap_or(0.0)));
    def(&m, "GetFloat", |_, a, o| n(o, cv(&ar(a, 0)).map(|c| cv_num(&c)).unwrap_or(0.0)));
    def(&m, "GetBool", |_, a, o| b(o, cv(&ar(a, 0)).map(|c| { let x = cv_num(&c); (x != 0.0 && !x.is_nan()) || c.borrow().v == "true" }).unwrap_or(false)));
    def(&m, "GetString", |_, a, o| s(o, &cv(&ar(a, 0)).map(|c| c.borrow().v.clone()).unwrap_or_default()));
    def(&m, "GetDefault", |_, a, o| s(o, &cv(&ar(a, 0)).map(|c| c.borrow().d.clone()).unwrap_or_default()));
    def(&m, "GetName", |_, a, o| s(o, &cv(&ar(a, 0)).map(|c| c.borrow().n.clone()).unwrap_or_default()));
    def(&m, "GetHelpText", |_, a, o| ok1(o, cv(&ar(a, 0)).map(|c| c.borrow().h.clone()).unwrap_or(Valor::Nil)));
    def(&m, "SetInt", |e, a, _| { if let Some(c) = cv(&ar(a, 0)) { let nm = c.borrow().n.clone(); cvar_poner(e, &nm, &jxlua::numeros::js_tostring(mas(&ar(a, 1)).trunc())); } Ok(()) });
    def(&m, "SetFloat", |e, a, _| { if let Some(c) = cv(&ar(a, 0)) { let nm = c.borrow().n.clone(); cvar_poner(e, &nm, &js_str(&ar(a, 1))); } Ok(()) });
    def(&m, "SetBool", |e, a, _| { if let Some(c) = cv(&ar(a, 0)) { let nm = c.borrow().n.clone(); cvar_poner(e, &nm, if js_t(&ar(a, 1)) { "1" } else { "0" }); } Ok(()) });
    def(&m, "SetString", |e, a, _| { if let Some(c) = cv(&ar(a, 0)) { let nm = c.borrow().n.clone(); cvar_poner(e, &nm, &js_str(&ar(a, 1))); } Ok(()) });
    def(&m, "Revert", |e, a, _| { if let Some(c) = cv(&ar(a, 0)) { let (nm, d) = { let x = c.borrow(); (x.n.clone(), x.d.clone()) }; cvar_poner(e, &nm, &d); } Ok(()) });
    def(&m, "GetMin", |_, a, o| ok1(o, cv(&ar(a, 0)).and_then(|c| c.borrow().mn).map(Valor::Num).unwrap_or(Valor::Nil)));
    def(&m, "GetMax", |_, a, o| ok1(o, cv(&ar(a, 0)).and_then(|c| c.borrow().mx).map(Valor::Num).unwrap_or(Valor::Nil)));
    def(&m, "IsFlagSet", |_, _, o| b(o, false));
    g(|g| g.mt.cvar = Some(m.clone()));
    m
}
fn d_str(v: &Valor) -> Option<String> { if v.es_nil() { None } else { Some(js_str(v)) } }

// ---------------- include, require, correr un archivo ----------------
/// DEFINE_BASECLASS(x) → local BaseClass = baseclass.Get(x) (con un nivel de paréntesis adentro, como la web)
pub(crate) fn define_baseclass(src: &[u8]) -> std::borrow::Cow<'_, [u8]> {
    const M: &[u8] = b"DEFINE_BASECLASS";
    if !src.windows(M.len()).any(|w| w == M) { return std::borrow::Cow::Borrowed(src); }
    let mut out = Vec::with_capacity(src.len() + 32);
    let mut i = 0;
    while i < src.len() {
        if src[i..].starts_with(M) {
            let mut j = i + M.len();
            while j < src.len() && (src[j] == b' ' || src[j] == b'\t' || src[j] == b'\r' || src[j] == b'\n' || src[j] == 0x0b || src[j] == 0x0c) { j += 1; }
            // (DEFINE_BASECLASS "x": la llamada con una cadena sin paréntesis)
            if j < src.len() && (src[j] == b'"' || src[j] == b'\'') {
                let q = src[j]; let mut k = j + 1;
                while k < src.len() && src[k] != q && src[k] != b'\n' { if src[k] == b'\\' { k += 1; } k += 1; }
                if k < src.len() && src[k] == q {
                    out.extend_from_slice(b"local BaseClass = baseclass.Get(");
                    out.extend_from_slice(&src[j..=k]);
                    out.push(b')');
                    i = k + 1;
                    continue;
                }
            }
            if j < src.len() && src[j] == b'(' {
                // [^()\n]*(?:\([^()\n]*\)[^()\n]*)*\)
                let ini = j + 1;
                let mut k = ini;
                let mut ok = None;
                loop {
                    while k < src.len() && src[k] != b'(' && src[k] != b')' && src[k] != b'\n' { k += 1; }
                    if k >= src.len() || src[k] == b'\n' { break; }
                    if src[k] == b')' { ok = Some(k); break; }
                    // un paréntesis de adentro
                    let mut q = k + 1;
                    while q < src.len() && src[q] != b'(' && src[q] != b')' && src[q] != b'\n' { q += 1; }
                    if q < src.len() && src[q] == b')' { k = q + 1; } else { break; }
                }
                if let Some(fin) = ok {
                    out.extend_from_slice(b"local BaseClass = baseclass.Get(");
                    out.extend_from_slice(&src[ini..fin]);
                    out.push(b')');
                    i = fin + 1;
                    continue;
                }
            }
        }
        out.push(src[i]);
        i += 1;
    }
    std::borrow::Cow::Owned(out)
}
/// gmaCorrer: correr un .lua (con DEFINE_BASECLASS); devuelve lo primero que devuelve
pub(crate) fn correr(e: &mut Estado, ruta: &str, b0: &[u8]) -> Valor {
    let b1 = b0.strip_prefix(b"\xEF\xBB\xBF").unwrap_or(b0);
    if std::env::var_os("JXM_TRAZA_ARCH").is_some() { eprintln!("lua: {}", ruta); }
    let src = define_baseclass(b1);
    let dir = match ruta.rfind('/') { Some(i) => ruta[..=i].to_string(), None => String::new() };
    let d0 = g(|g| std::mem::replace(&mut g.dir, dir));
    let r = match e.compilar(&src, ruta) {
        Ok(f) => match e.llamar(&f, &[]) { Ok(v) => v.into_iter().next().unwrap_or(Valor::Nil), Err(x) => { gma_err(&x.mensaje()); Valor::Nil } },
        Err(x) => { gma_err(&x.mensaje()); Valor::Nil }
    };
    g(|g| g.dir = d0);
    r
}
/// gmaIncluir: relativo al archivo que incluye, si no desde lua/
pub(crate) fn incluir(e: &mut Estado, r: &str) -> Valor {
    let r = r.replace('\\', "/").to_lowercase();
    let dir = g(|g| g.dir.clone());
    for c in [format!("{}{}", dir, r), format!("lua/{}", r), r.clone(), r.clone(), format!("gamemodes/{}", r)] {
        if let Some(bb) = archivo(&c) { return correr(e, &c, &bb); }
    }
    let wire = r.starts_with("wire/") || (r.starts_with("entities/base_wire_entity") && ["entities/base_wire_entity.lua", "entities/base_wire_entity/init.lua", "entities/base_wire_entity/shared.lua", "entities/base_wire_entity/cl_init.lua"].contains(&r.as_str()));
    if wire { return Valor::Nil; }
    gma_err(&format!("include: no se encontró '{}' (desde {})", r, if dir.is_empty() { "lua/".to_string() } else { dir }));
    Valor::Nil
}

// ---------------- JSON (como JSON.stringify/parse con gmaAJS/gmaALua) ----------------
fn json_cad(s: &str, out: &mut String) {
    out.push('"');
    for c in s.chars() {
        match c { '"' => out.push_str("\\\""), '\\' => out.push_str("\\\\"), '\n' => out.push_str("\\n"), '\r' => out.push_str("\\r"), '\t' => out.push_str("\\t"), '\u{8}' => out.push_str("\\b"), '\u{c}' => out.push_str("\\f"), c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)), c => out.push(c) }
    }
    out.push('"');
}
fn json_num(x: f64) -> String { if x.is_finite() { jxlua::numeros::js_tostring(x) } else { "null".into() } }
fn es_indice(k: &str) -> bool { !k.is_empty() && k.len() < 10 && k.bytes().all(|c| c.is_ascii_digit()) && (k == "0" || !k.starts_with('0')) }
/// gmaAJS + JSON.stringify
fn a_json(v: &Valor, prof: u32, sang: usize, nivel: usize, out: &mut String) {
    let ind = |out: &mut String, n: usize| if sang > 0 { out.push('\n'); for _ in 0..n * sang { out.push(' '); } };
    if prof > 20 { out.push_str("null"); return; }
    match v {
        Valor::Nil => out.push_str("null"),
        Valor::Bool(x) => out.push_str(if *x { "true" } else { "false" }),
        Valor::Num(x) => out.push_str(&json_num(*x)),
        Valor::Cad(c) => json_cad(&c.texto(), out),
        Valor::Tabla(t) => {
            let (arr, hash): (Vec<Valor>, Vec<(Valor, Valor)>) = {
                let b = t.borrow();
                let n = b.len();
                let arr: Vec<Valor> = (1..=n).map(|i| b.get_int(i as i64)).collect();
                let hash: Vec<(Valor, Valor)> = b.pares().into_iter().filter(|(k, _)| !matches!(k, Valor::Num(x) if *x >= 1.0 && *x <= n as f64 && x.fract() == 0.0)).collect();
                (arr, hash)
            };
            if hash.is_empty() {
                if arr.is_empty() { out.push_str("[]"); return; }
                out.push('[');
                for (i, x) in arr.iter().enumerate() { if i > 0 { out.push(','); } ind(out, nivel + 1); a_json(x, prof + 1, sang, nivel + 1, out); }
                ind(out, nivel); out.push(']');
                return;
            }
            // (un objeto de JavaScript: primero las claves que son índices, en orden, después las demás como se pusieron)
            let mut ks: Vec<(String, Valor)> = Vec::new();
            for (i, x) in arr.into_iter().enumerate() { ks.push(((i + 1).to_string(), x)); }
            for (k, x) in hash { let kk = js_str(&k); if let Some(p) = ks.iter().position(|y| y.0 == kk) { ks[p].1 = x; } else { ks.push((kk, x)); } }
            let mut idx: Vec<(String, Valor)> = ks.iter().filter(|x| es_indice(&x.0)).cloned().collect();
            idx.sort_by_key(|x| x.0.parse::<u64>().unwrap_or(0));
            let resto: Vec<(String, Valor)> = ks.into_iter().filter(|x| !es_indice(&x.0)).collect();
            let todo: Vec<(String, Valor)> = idx.into_iter().chain(resto).filter(|x| !matches!(x.1, Valor::Func(_)) || true).collect();
            out.push('{');
            let mut primero = true;
            for (k, x) in todo {
                if !primero { out.push(','); }
                primero = false;
                ind(out, nivel + 1);
                json_cad(&k, out);
                out.push(':');
                if sang > 0 { out.push(' '); }
                a_json(&x, prof + 1, sang, nivel + 1, out);
            }
            ind(out, nivel); out.push('}');
        }
        Valor::Udata(_) => {
            if let Some(x) = vec_de(v) { json_cad(&format!("[{} {} {}]", jxlua::numeros::js_tostring(x[0]), jxlua::numeros::js_tostring(x[1]), jxlua::numeros::js_tostring(x[2])), out); }
            else if let Some(x) = ang_de(v) { json_cad(&format!("{{{} {} {}}}", jxlua::numeros::js_tostring(x[0]), jxlua::numeros::js_tostring(x[1]), jxlua::numeros::js_tostring(x[2])), out); }
            else { out.push_str("null"); }
        }
        _ => out.push_str("null"),
    }
}
struct Lector<'a> { s: &'a [u8], i: usize }
impl<'a> Lector<'a> {
    fn esp(&mut self) { while self.i < self.s.len() && matches!(self.s[self.i], b' ' | b'\t' | b'\n' | b'\r') { self.i += 1; } }
    fn valor(&mut self) -> Option<Valor> {
        self.esp();
        let c = *self.s.get(self.i)?;
        match c {
            b'{' => {
                self.i += 1;
                let t = Tabla::nueva_ref();
                let mut pares: Vec<(String, Valor)> = Vec::new();
                self.esp();
                if self.s.get(self.i) == Some(&b'}') { self.i += 1; return Some(Valor::Tabla(t)); }
                loop {
                    self.esp();
                    let Valor::Cad(k) = self.valor()? else { return None };
                    self.esp();
                    if self.s.get(self.i) != Some(&b':') { return None; }
                    self.i += 1;
                    let v = self.valor()?;
                    let k = k.texto().into_owned();
                    if let Some(p) = pares.iter().position(|x| x.0 == k) { pares[p].1 = v; } else { pares.push((k, v)); }
                    self.esp();
                    match self.s.get(self.i) { Some(b',') => self.i += 1, Some(b'}') => { self.i += 1; break; } _ => return None }
                }
                let mut idx: Vec<(String, Valor)> = pares.iter().filter(|x| es_indice(&x.0)).cloned().collect();
                idx.sort_by_key(|x| x.0.parse::<u64>().unwrap_or(0));
                for (k, v) in idx.into_iter().chain(pares.into_iter().filter(|x| !es_indice(&x.0))) {
                    let kv = if k.bytes().all(|c| c.is_ascii_digit()) && !k.is_empty() { Valor::Num(k.parse::<f64>().unwrap_or(0.0)) } else { cad(&k) };
                    if !v.es_nil() { let _ = t.borrow_mut().set(kv, v); }
                }
                Some(Valor::Tabla(t))
            }
            b'[' => {
                self.i += 1;
                let mut v = Vec::new();
                self.esp();
                if self.s.get(self.i) == Some(&b']') { self.i += 1; return Some(tab_de(v)); }
                loop {
                    v.push(self.valor()?);
                    self.esp();
                    match self.s.get(self.i) { Some(b',') => self.i += 1, Some(b']') => { self.i += 1; break; } _ => return None }
                }
                let t = Tabla::nueva_ref();
                for (i, x) in v.into_iter().enumerate() { if !x.es_nil() { let _ = t.borrow_mut().set(Valor::Num((i + 1) as f64), x); } }
                Some(Valor::Tabla(t))
            }
            b'"' => {
                self.i += 1;
                let mut out: Vec<u16> = Vec::new();
                loop {
                    let c = *self.s.get(self.i)?;
                    self.i += 1;
                    match c {
                        b'"' => break,
                        b'\\' => {
                            let e = *self.s.get(self.i)?;
                            self.i += 1;
                            match e {
                                b'n' => out.push(10), b't' => out.push(9), b'r' => out.push(13), b'b' => out.push(8), b'f' => out.push(12), b'/' => out.push(47), b'\\' => out.push(92), b'"' => out.push(34),
                                b'u' => { let h = std::str::from_utf8(self.s.get(self.i..self.i + 4)?).ok()?; out.push(u16::from_str_radix(h, 16).ok()?); self.i += 4; }
                                _ => return None,
                            }
                        }
                        c if c < 0x80 => out.push(c as u16),
                        _ => {
                            // (UTF-8 → UTF-16)
                            let ini = self.i - 1;
                            let mut fin = self.i;
                            while fin < self.s.len() && (self.s[fin] & 0xC0) == 0x80 { fin += 1; }
                            let t = String::from_utf8_lossy(&self.s[ini..fin]).into_owned();
                            out.extend(t.encode_utf16());
                            self.i = fin;
                        }
                    }
                }
                Some(Valor::from(String::from_utf16_lossy(&out)))
            }
            b't' if self.s[self.i..].starts_with(b"true") => { self.i += 4; Some(Valor::Bool(true)) }
            b'f' if self.s[self.i..].starts_with(b"false") => { self.i += 5; Some(Valor::Bool(false)) }
            b'n' if self.s[self.i..].starts_with(b"null") => { self.i += 4; Some(Valor::Nil) }
            _ => {
                let ini = self.i;
                while self.i < self.s.len() && matches!(self.s[self.i], b'-' | b'+' | b'.' | b'e' | b'E' | b'0'..=b'9') { self.i += 1; }
                std::str::from_utf8(&self.s[ini..self.i]).ok()?.parse::<f64>().ok().map(Valor::Num)
            }
        }
    }
}
fn de_json(s: &[u8]) -> Option<Valor> { let mut l = Lector { s, i: 0 }; let v = l.valor()?; l.esp(); if l.i != s.len() { return None; } Some(v) }

// ---------------- efectos, daño, partículas ----------------
/// el CEffectData (EffectData)
pub(crate) struct EfData(pub TablaRef);
fn efd(v: &Valor) -> Option<TablaRef> { match v { Valor::Udata(u) => u.con(|x: &EfData| x.0.clone()), _ => None } }
/// una partícula de un ParticleEmitter
pub(crate) struct Part { pub mat: String, pub p: V3, pub v: V3, pub vida: f64, pub t0: f64, pub t1: f64, pub a0: f64, pub a1: f64, pub c: [f64; 3], pub g: V3 }
pub(crate) struct Emisor(pub Valor);
/// un CSoundPatch
pub(crate) struct Parche { pub id: u32, pub e: Valor, pub s: Valor, pub vol: Valor, pub tono: Valor, pub on: bool }

pub(crate) fn instalar(e: &mut Estado) {
    let gl = e.globales();
    let mundo = nueva_ent("worldspawn", TipoEnt::Mundo);
    ce(&mundo, |x| x.id = 0);
    let jug = nueva_ent("player", TipoEnt::Jug);
    g(|g| { g.mundo = mundo; g.jug = jug; });
    // ---- globales ----
    def(&gl, "IsValid", |e, a, o| {
        let x = ar(a, 0);
        match &x {
            Valor::Nil | Valor::Bool(false) => b(o, false),
            _ if es_ent(&x) => b(o, ent_valida(&x)),
            Valor::Tabla(_) | Valor::Udata(_) => {
                let f = e.indexar(&x, &cad("IsValid")).unwrap_or(Valor::Nil);
                if let Valor::Func(_) = f { let r = e.llamar_aqui(&f, &[x.clone()])?; b(o, t(&primero(&r))) } else { b(o, !matches!(x, Valor::Tabla(_))) }
            }
            _ => b(o, true),
        }
    });
    def(&gl, "LocalPlayer", |_, _, o| ok1(o, g(|g| g.jug.clone())));
    def(&gl, "Entity", |_, a, o| {
        let i = ar(a, 0);
        ok1(o, match i { Valor::Num(x) if x == 1.0 => g(|g| g.jug.clone()), Valor::Num(x) if x == 0.0 => g(|g| g.mundo.clone()), Valor::Num(x) if x.fract() == 0.0 => g(|g| g.ent_get(x as i64)).unwrap_or_else(null), _ => null() })
    });
    for k in ["CurTime", "UnPredictedCurTime"] { def(&gl, k, |_, _, o| n(o, tiempo())); }
    for k in ["RealTime", "SysTime", "VGUIFrameTime"] { def(&gl, k, |_, _, o| n(o, h(|h| h.reloj().1))); }
    for k in ["FrameTime", "RealFrameTime"] { def(&gl, k, |_, _, o| { let d = h(|h| h.dt()); n(o, if d == 0.0 || d.is_nan() { 1.0 / 60.0 } else { d }) }); }
    def(&gl, "FrameNumber", |_, _, o| n(o, g(|g| g.cuadro) as f64));
    def(&gl, "ScrW", |_, _, o| n(o, h(|h| h.pantalla().0)));
    def(&gl, "ScrH", |_, _, o| n(o, h(|h| h.pantalla().1)));
    def(&gl, "EyePos", |_, _, o| ok1(o, vv(h(|h| h.cam().pos))));
    def(&gl, "EyeAngles", |_, _, o| ok1(o, naa(dir_ang(ds(h(|h| h.cam().fwd))))));
    def(&gl, "EyeVector", |_, _, o| ok1(o, vvd(h(|h| h.cam().fwd))));
    for k in ["Sound", "Model"] { def(&gl, k, |_, a, o| ok1(o, ar(a, 0))); }
    def(&gl, "AddCSLuaFile", nada);
    def(&gl, "IsFirstTimePredicted", |_, _, o| b(o, true));
    def(&gl, "SoundDuration", |_, _, o| n(o, 1.0));
    def(&gl, "GetHostName", |_, _, o| s(o, "JXMod"));
    for k in ["include", "IncludeCS"] { def(&gl, k, |e, a, o| { let r = js_str(&ar(a, 0)); ok1(o, incluir(e, &r)) }); }
    def(&gl, "require", |e, a, o| {
        let k: String = js_str(&ar(a, 0)).to_lowercase().chars().filter(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '.' || *c == '-').collect();
        if let Some(v) = g(|g| g.requeridos.get(&k).cloned()) { return ok1(o, v); }
        g(|g| g.requeridos.insert(k.clone(), Valor::Bool(true)));
        let r = format!("lua/includes/modules/{}.lua", k);
        if let Some(bb) = archivo(&r) { let v = correr(e, &r, &bb); if !v.es_nil() { g(|g| g.requeridos.insert(k.clone(), v)); } }
        ok1(o, g(|g| g.requeridos.get(&k).cloned()).unwrap_or(Valor::Nil))
    });
    for k in ["Msg", "MsgN"] { def(&gl, k, |e, a, _| { let v = unir(e, a, b"")?; consola(&String::from_utf8_lossy(&v)); Ok(()) }); }
    def(&gl, "MsgC", |e, a, _| {
        let cm = g(|g| g.mt.col.clone());
        let v: Vec<Valor> = a.iter().filter(|x| !matches!(x, Valor::Tabla(t) if t.borrow().meta().zip(cm.clone()).map(|(p, q)| Rc::ptr_eq(&p, &q)).unwrap_or(false))).cloned().collect();
        let s = unir(e, &v, b"")?;
        consola(&String::from_utf8_lossy(&s));
        Ok(())
    });
    def(&gl, "__jxFrase", |_, _, o| ok1(o, Valor::Nil));
    for k in ["ErrorNoHalt", "ErrorNoHaltWithStack"] { def(&gl, k, |e, a, _| { let v = unir(e, a, b"")?; gma_err(&String::from_utf8_lossy(&v)); Ok(()) }); }
    def(&gl, "ProtectedCall", |e, a, o| {
        let f = ar(a, 0);
        match e.llamar_aqui(&f, &a[1.min(a.len())..]) { Ok(_) => b(o, true), Err(x) => { if x.es_duro() { return Err(x); } gma_err(&x.mensaje()); b(o, false) } }
    });
    def(&gl, "Error", |e, a, _| { let v = unir(e, a, b"")?; Err(Error::con_valor(Valor::from(v))) });
    def(&gl, "CompileString", |e, a, o| {
        let src = jxlua::bib::js_texto(&ar(a, 0));
        let nm = ar(a, 1);
        let nombre = if js_t(&nm) { js_str(&nm) } else { "CompileString".to_string() };
        match e.compilar(&src, &nombre) { Ok(f) => ok1(o, f), Err(x) => { if matches!(ar(a, 2), Valor::Bool(false)) { s(o, &x.mensaje()) } else { Err(x) } } }
    });
    def(&gl, "RunString", |e, a, _| {
        let src = jxlua::bib::js_texto(&ar(a, 0));
        let nm = ar(a, 1);
        let nombre = if js_t(&nm) { js_str(&nm) } else { "RunString".to_string() };
        let r = e.compilar(&src, &nombre).and_then(|f| e.llamar_aqui(&f, &[]));
        if let Err(x) = r { gma_err(&x.mensaje()); }
        Ok(())
    });
    {
        let gl2 = gl.clone();
        def(&gl, "RunStringEx", move |e, a, o| { let f = gl2.borrow().get_str("RunString"); o.extend(e.llamar_aqui(&f, &[ar(a, 0), ar(a, 1)])?); Ok(()) });
    }
    if let Valor::Tabla(dbg) = gl.borrow().get_str("debug") {
        def(&dbg, "getregistry", |_, _, o| { let t = Tabla::nueva_ref(); for (k, v) in g(|g| g.metas.v.clone()) { t.borrow_mut().set_str(&k, Valor::Tabla(v)); } ok1(o, Valor::Tabla(t)) });
    }
    def(&gl, "FindMetaTable", |e, a, o| {
        let nm = js_str(&ar(a, 0));
        if nm == "ConVar" { return ok1(o, Valor::Tabla(mt_cvar())); }
        if nm == "CMoveData" { return ok1(o, Valor::Tabla(crate::cargar::mt_mov(e))); }
        let ok = nm.len() >= 2 && nm.as_bytes()[0].is_ascii_uppercase() && nm.bytes().skip(1).all(|c| c.is_ascii_alphabetic() || c == b'_');
        if !g(|g| g.metas.has(&nm)) && ok { let t = Tabla::nueva_ref(); t.borrow_mut().set_filtro(Some(crate::valores::filtro_lados())); t.borrow_mut().set_str("MetaName", cad(&nm)); t.borrow_mut().set_str("__index", Valor::Tabla(t.clone())); g(|g| g.metas.set(nm.clone(), t)); }
        ok1(o, g(|g| g.metas.get(&nm).cloned()).map(Valor::Tabla).unwrap_or(Valor::Nil))
    });
    def(&gl, "RegisterMetaTable", |_, a, _| { if let Valor::Tabla(t) = ar(a, 1) { let nm = js_str(&ar(a, 0)); g(|g| g.metas.set(nm, t)); } Ok(()) });
    def(&gl, "SafeRemoveEntity", |e, a, _| { quitar(e, &ar(a, 0)); Ok(()) });
    def(&gl, "SafeRemoveEntityDelayed", |_, a, _| { let x = ar(a, 0); let tt = tiempo() + num(&ar(a, 1), 0.0); g(|g| g.t_simples.push(TSimple { t: tt, f: Accion::Rust(Box::new(move |e| quitar(e, &x))), ctx: Lado::S })); Ok(()) });
    for k in ["BroadcastLua", "SendUserMessage", "AddWorldTip", "DeriveGamemode"] { def(&gl, k, nada); }
    def(&gl, "CreateClientConVar", |_, a, o| ok1(o, cvar(&js_str(&ar(a, 0)), d_str(&ar(a, 1)), ar(a, 4), ar(a, 5), ar(a, 6))));
    def(&gl, "CreateConVar", |_, a, o| ok1(o, cvar(&js_str(&ar(a, 0)), d_str(&ar(a, 1)), ar(a, 3), ar(a, 4), ar(a, 5))));
    for k in ["GetConVar", "GetConVar_Internal"] { def(&gl, k, |_, a, o| { let nm = js_str(&ar(a, 0)); ok1(o, if cv_hay(&nm) { cvar(&nm, None, Valor::Nil, Valor::Nil, Valor::Nil) } else { Valor::Nil }) }); }
    def(&gl, "GetConVarNumber", |_, a, o| { let nm = js_str(&ar(a, 0)); n(o, if cv_hay(&nm) { g(|g| g.cvars.get(&nm).cloned()).map(|c| cv_num(&c)).unwrap_or(0.0) } else { 0.0 }) });
    def(&gl, "GetConVarString", |_, a, o| { let nm = js_str(&ar(a, 0)); s(o, &if cv_hay(&nm) { g(|g| g.cvars.get(&nm).map(|c| c.borrow().v.clone())).unwrap_or_default() } else { String::new() }) });
    def(&gl, "ConVarExists", |_, a, o| b(o, cv_hay(&js_str(&ar(a, 0)))));
    def(&gl, "RunConsoleCommand", |e, a, _| { let v = unir(e, a, b" ")?; consola2(e, &String::from_utf8_lossy(&v)); Ok(()) });
    def(&gl, "ParticleEmitter", |_, a, o| { let mt = g(|g| g.mt.emisor.clone()); ok1(o, Valor::Udata(Udata::nueva(Emisor(ar(a, 0)), mt))) });
    def(&gl, "EffectData", |_, _, o| { let mt = g(|g| g.mt.efecto.clone()); ok1(o, Valor::Udata(Udata::nueva(EfData(Tabla::nueva_ref()), mt))) });
    def(&gl, "DamageInfo", |_, _, o| ok1(o, dmg_info(0.0, None, None, None)));
    def(&gl, "ClientsideModel", |_, a, o| {
        let x = nueva_ent("class C_BaseFlex", TipoEnt::Ent);
        let m = ar(a, 0);
        let ms = if js_t(&m) { js_str(&m) } else { String::new() }.to_lowercase().replace('\\', "/");
        ce(&x, |y| { y.modelo = ms; y.cs = true; y.creado = true; y.pos = V3::default(); });
        ok1(o, x)
    });
    for k in ["ClientsideRagdoll", "ClientsideScene"] { def(&gl, k, |_, _, o| ok1(o, null())); }
    def(&gl, "CreateSound", |_, a, o| { let mt = g(|g| g.mt.snd.clone()); ok1(o, Valor::Udata(Udata::nueva(Parche { id: sig_snd(), e: ar(a, 0), s: ar(a, 1), vol: Valor::Num(1.0), tono: Valor::Num(100.0), on: false }, mt))) });
    def(&gl, "Material", |_, a, o| ok1(o, crate::resto::material(&js_str(&ar(a, 0)))));
    def(&gl, "CreateMaterial", |_, a, o| {
        let nm = ar(a, 0);
        let nms = if js_t(&nm) { js_str(&nm) } else { String::new() };
        if let Valor::Tabla(p) = ar(a, 2) { if let Valor::Cad(bt) = tget(&p, "$basetexture") { if !bt.is_empty() { return ok1(o, crate::resto::material(&bt.texto())); } } }
        ok1(o, crate::resto::material(&nms))
    });
    // (VMatrix de verdad: matriz.rs)
    crate::matriz::instalar(e);
    for (k, d) in [("GetGlobalInt", Valor::Num(0.0)), ("GetGlobalFloat", Valor::Num(0.0)), ("GetGlobalBool", Valor::Bool(false)), ("GetGlobalString", cad(""))] {
        def(&gl, k, move |_, a, o| { let v = g(|g| g.glob.get(&ar(a, 0)).cloned()).filter(|v| !v.es_nil()); ok1(o, v.unwrap_or_else(|| { let d2 = ar(a, 1); if d2.es_nil() { d.clone() } else { d2 } })) });
    }
    def(&gl, "GetGlobalEntity", |_, a, o| ok1(o, g(|g| g.glob.get(&ar(a, 0)).cloned()).filter(|v| !v.es_nil()).unwrap_or_else(null)));
    def(&gl, "GetGlobalVector", |_, a, o| ok1(o, g(|g| g.glob.get(&ar(a, 0)).cloned()).filter(|v| !v.es_nil()).unwrap_or_else(|| nv(0.0, 0.0, 0.0))));
    def(&gl, "GetGlobalAngle", |_, a, o| ok1(o, g(|g| g.glob.get(&ar(a, 0)).cloned()).filter(|v| !v.es_nil()).unwrap_or_else(|| na(0.0, 0.0, 0.0))));
    for tp in ["Int", "Float", "Bool", "String", "Entity", "Vector", "Angle", "Var"] {
        def(&gl, &format!("SetGlobal{}", tp), |_, a, _| { let (k, v) = (ar(a, 0), ar(a, 1)); g(|g| g.glob.set(k, v)); Ok(()) });
        def(&gl, &format!("SetGlobal2{}", tp), |_, a, _| { let (k, v) = (ar(a, 0), ar(a, 1)); g(|g| g.glob.set(k, v)); Ok(()) });
        def(&gl, &format!("GetGlobal2{}", tp), |_, a, o| ok1(o, g(|g| g.glob.get(&ar(a, 0)).cloned()).filter(|v| !v.es_nil()).unwrap_or_else(|| ar(a, 1))));
    }
    for k in ["GetRenderTarget", "GetRenderTargetEx"] { def(&gl, k, |_, _, o| ok1(o, crate::resto::material("rt"))); }
    for k in ["DrawBloom", "DrawBokehDOF", "DOFModeHack", "DOF_Start", "DOF_Kill", "RenderDoF", "RenderSuperDoF", "RenderStereoscopy", "DrawTexturize", "DrawMotionBlur", "DrawSharpen", "DrawSobel", "DrawToyTown", "DrawSunbeams"] { def(&gl, k, nada); }
    def(&gl, "DrawColorModify", |_, a, _| {
        let Valor::Tabla(tb) = ar(a, 0) else { return Ok(()) };
        let gk = |k: &str, d: f64| num(&tget(&tb, &format!("$pp_colour_{}", k)), d);
        let pp = [gk("addr", 0.0), gk("addg", 0.0), gk("addb", 0.0), gk("brightness", 0.0), gk("contrast", 1.0), gk("colour", 1.0), gk("mulr", 0.0), gk("mulg", 0.0), gk("mulb", 0.0)];
        g(|g| g.pp = Some(pp));
        Ok(())
    });
    def(&gl, "Format", |e, a, o| { let sf = e.globales().borrow().get_str("string"); let f = match sf { Valor::Tabla(t) => tget(&t, "format"), _ => Valor::Nil }; o.extend(e.llamar_aqui(&f, a)?); Ok(()) });
    // (de qué addon es cada entrada de las listas: el menú de GMod las agrupa por addon, como A.listas de la web)
    def(&gl, "__gmLista", |_, a, _| {
        let (n, k) = (ar(a, 0), ar(a, 1)); if !matches!(n, Valor::Cad(_)) || k.es_nil() { return Ok(()); }
        let (n, k) = (js_str(&n), js_str(&k));
        g(|g| { if let Some(id) = g.addon_actual.as_ref().map(|x| x.borrow().id.clone()) { g.listas_addon.insert((n, k), id); } });
        Ok(())
    });
    def(&gl, "GetViewEntity", |_, _, o| { let j = g(|g| g.jug.clone()); let v = ce(&j, |x| x.vista_ent.clone()).flatten().filter(ent_valida); ok1(o, v.unwrap_or(j)) });
    def(&gl, "IsMounted", |_, _, o| b(o, false));
    def(&gl, "GetMap", |_, _, o| s(o, &h(|h| h.nombre_mapa())));
    // ---- ents, player, game, engine ----
    let ents = lib(e, "ents");
    let player = lib(e, "player");
    let game = lib(e, "game");
    let engine = lib(e, "engine");
    def(&ents, "Create", |e, a, o| {
        let mut c = { let v = ar(a, 0); if js_t(&v) { js_str(&v) } else { String::new() } };
        let mut nom = None;
        { let m = c.to_lowercase(); if m != c && !g(|g| g.clases.has(&c) || g.armas.has(&c)) && g(|g| g.clases.has(&m) || g.armas.has(&m)) { nom = Some(c.clone()); c = m; } }
        let x = nueva_ent(&c, TipoEnt::Ent);
        let j = g(|g| g.jug.clone());
        ce(&x, |y| { y.clase_nom = nom; y.creador = Some(j); });
        if g(|g| g.clases.has(&c)) {
            let mo = clase_tabla(&c, Lado::S).map(|m| buscar_en_clase(&m, "Model")).unwrap_or(Valor::Nil);
            if let Valor::Cad(m) = &mo { if !m.is_empty() { let ms = m.texto().to_lowercase(); ce(&x, |y| y.modelo = ms); } }
            preparar(e, &x);
        } else if g(|g| g.armas.has(&c)) || arma_suelo_modelo(&c).is_some() {
            let wm = if g(|g| g.armas.has(&c)) { clase_tabla(&c, Lado::S).map(|m| buscar_en_clase(&m, "WorldModel")).unwrap_or(Valor::Nil) } else { cad(arma_suelo_modelo(&c).unwrap()) };
            let cc = c.clone();
            ce(&x, |y| { y.arma_suelo = Some(cc); if js_t(&wm) { y.modelo = js_str(&wm).to_lowercase(); } });
        }
        ok1(o, x)
    });
    def(&ents, "CreateClientProp", |_, a, o| { let x = nueva_ent("prop_physics", TipoEnt::Ent); let m = ar(a, 0); let ms = if js_t(&m) { js_str(&m) } else { String::new() }; ce(&x, |y| y.modelo = ms); ok1(o, x) });
    {
        let ents2 = ents.clone();
        def(&ents, "CreateClientside", move |e, a, o| {
            let f = ents2.borrow().get_str("Create");
            let x = primero(&e.llamar_aqui(&f, &[ar(a, 0)])?);
            ce(&x, |y| { y.solo_c = true; y.tabla_c = Some(y.tabla.clone()); });
            ok1(o, x)
        });
    }
    def(&ents, "GetAll", |_, _, o| { let j = g(|g| g.jug.clone()); let mut v = vec![j]; v.extend(todos()); ok1(o, tab_de(v)) });
    def(&ents, "GetCount", |_, _, o| n(o, (todos().len() + 1) as f64));
    {
        let gl2 = gl.clone();
        def(&ents, "GetByIndex", move |e, a, o| { let f = gl2.borrow().get_str("Entity"); o.extend(e.llamar_aqui(&f, &[ar(a, 0)])?); Ok(()) });
    }
    def(&ents, "Iterator", |_, _, o| {
        let j = g(|g| g.jug.clone());
        let mut l = vec![j];
        l.extend(todos());
        let i = Rc::new(std::cell::Cell::new(0usize));
        o.push(fnat(move |_, _, o| { let k = i.get(); if k < l.len() { i.set(k + 1); o.push(Valor::Num((k + 1) as f64)); o.push(l[k].clone()); } else { o.push(Valor::Nil); } Ok(()) }));
        o.push(Valor::Nil);
        o.push(Valor::Num(0.0));
        Ok(())
    });
    def(&ents, "FindByClass", |_, a, o| {
        let pat = js_str(&ar(a, 0)).to_lowercase();
        let j = g(|g| g.jug.clone());
        let mut l = vec![j];
        l.extend(todos());
        let v: Vec<Valor> = l.into_iter().filter(|x| ce(x, |y| glob(&pat, &y.clase.to_lowercase())).unwrap_or(false)).collect();
        ok1(o, tab_de(v))
    });
    def(&ents, "FindByModel", |_, a, o| { let m = js_str(&ar(a, 0)).to_lowercase(); let v: Vec<Valor> = todos().into_iter().filter(|x| ce(x, |y| y.modelo == m).unwrap_or(false)).collect(); ok1(o, tab_de(v)) });
    for k in ["FindByName", "FindByClassAndParent", "FindAlongRay"] { def(&ents, k, |_, _, o| ok1(o, tnueva())); }
    let en_esfera = |c: &Valor, r: f64| -> Vec<Valor> {
        let p = match vec_de(c) { Some(v) => a_juego(v), None => if c.es_nil() { V3::default() } else { v3(f64::NAN, f64::NAN, f64::NAN) } };
        let j = g(|g| g.jug.clone());
        let mut l = vec![j];
        l.extend(todos());
        l.into_iter().filter(|x| ent_pos(x).dist(p) <= r * GS).collect()
    };
    def(&ents, "FindInSphere", move |_, a, o| ok1(o, tab_de(en_esfera(&ar(a, 0), num(&ar(a, 1), 0.0)))));
    def(&ents, "FindInCone", move |_, a, o| ok1(o, tab_de(en_esfera(&ar(a, 0), num(&ar(a, 2), 0.0)))));
    def(&ents, "FindInBox", |_, a, o| {
        let (p, q) = (vx(&ar(a, 0))?, vx(&ar(a, 1))?);
        let lo = [p[0].min(q[0]), p[1].min(q[1]), p[2].min(q[2])];
        let hi = [p[0].max(q[0]), p[1].max(q[1]), p[2].max(q[2])];
        let j = g(|g| g.jug.clone());
        let mut l = vec![j];
        l.extend(todos());
        let v: Vec<Valor> = l.into_iter().filter(|x| { let w = a_source(ent_pos(x)); (0..3).all(|i| w[i] >= lo[i] && w[i] <= hi[i]) }).collect();
        ok1(o, tab_de(v))
    });
    for k in ["GetAll", "GetHumans"] { def(&player, k, |_, _, o| ok1(o, tab_de(vec![g(|g| g.jug.clone())]))); }
    def(&player, "GetBots", |_, _, o| ok1(o, tnueva()));
    def(&player, "GetCount", |_, _, o| n(o, 1.0));
    def(&player, "GetByID", |_, a, o| ok1(o, if matches!(ar(a, 0), Valor::Num(x) if x == 1.0) { g(|g| g.jug.clone()) } else { null() }));
    for k in ["GetBySteamID", "GetBySteamID64"] { def(&player, k, |_, _, o| ok1(o, g(|g| g.jug.clone()))); }
    def(&player, "Iterator", |_, _, o| {
        let l = vec![g(|g| g.jug.clone())];
        let i = Rc::new(std::cell::Cell::new(0usize));
        o.push(fnat(move |_, _, o| { let k = i.get(); if k < l.len() { i.set(k + 1); o.push(Valor::Num((k + 1) as f64)); o.push(l[k].clone()); } else { o.push(Valor::Nil); } Ok(()) }));
        o.push(Valor::Nil);
        o.push(Valor::Num(0.0));
        Ok(())
    });
    def(&game, "SinglePlayer", |_, _, o| b(o, true));
    def(&game, "MaxPlayers", |_, _, o| n(o, 16.0));
    def(&game, "GetMap", |_, _, o| s(o, &h(|h| h.nombre_mapa())));
    def(&game, "GetWorld", |_, _, o| ok1(o, g(|g| g.mundo.clone())));
    def(&game, "IsDedicated", |_, _, o| b(o, false));
    def(&game, "ConsoleCommand", |e, a, _| { consola2(e, &js_str(&ar(a, 0))); Ok(()) });
    for k in ["AddParticles", "AddDecal", "AddAmmoType", "CleanUpMap", "SetTimeScale", "BuildAmmoTypes", "MountGMA", "LoadNextMap", "KickID", "SetGlobalCounter"] { def(&game, k, nada); }
    def(&game, "GetTimeScale", |_, _, o| n(o, 1.0));
    def(&game, "GetAmmoID", |_, _, o| n(o, 1.0));
    def(&game, "GetAmmoName", |_, _, o| s(o, "Pistol"));
    def(&game, "GetAmmoMax", |_, _, o| n(o, 9999.0));
    def(&game, "GetGlobalState", |_, a, o| { let k = js_str(&ar(a, 0)); n(o, g(|g| g.globales.get(&k).copied()).unwrap_or(0.0)) });
    def(&game, "SetGlobalState", |_, a, _| { let k = js_str(&ar(a, 0)); let v = i32_de(num(&ar(a, 1), 0.0)) as f64; g(|g| g.globales.insert(k, v)); Ok(()) });
    def(&game, "GetGlobalCounter", |_, _, o| n(o, 0.0));
    def(&game, "GetAmmoTypes", |_, _, o| ok1(o, tab_de(["Pistol", "SMG1", "AR2", "Buckshot", "357", "XBowBolt", "RPG_Round", "Grenade"].iter().map(|x| cad(x)).collect())));
    def(&game, "GetSkillLevel", |_, _, o| n(o, 2.0));
    def(&game, "GetIPAddress", |_, _, o| s(o, "loopback"));
    def(&engine, "ActiveGamemode", |_, _, o| s(o, "sandbox"));
    def(&engine, "TickInterval", |_, _, o| n(o, 1.0 / 60.0));
    for k in ["GetGames", "GetGamemodes"] { def(&engine, k, |_, _, o| ok1(o, tnueva())); }
    def(&engine, "GetAddons", |_, _, o| {
        let v: Vec<Valor> = g(|g| g.addons.iter().map(|a| { let a = a.borrow(); (a.nombre.clone(), a.id.clone()) }).collect::<Vec<_>>()).into_iter().map(|(nm, id)| tabla_kv(vec![("title", cad(&nm)), ("wsid", cad(&id)), ("file", cad(&format!("addons/{}.gma", id))), ("mounted", Valor::Bool(true)), ("downloaded", Valor::Bool(true)), ("models", Valor::Num(0.0)), ("tags", cad("")), ("timeadded", Valor::Num(0.0)), ("updated", Valor::Num(0.0)), ("size", Valor::Num(0.0))])).collect();
        ok1(o, tab_de(v))
    });
    for k in ["IsPlayingDemo", "IsRecordingDemo"] { def(&engine, k, |_, _, o| b(o, false)); }
    def(&engine, "LightStyle", nada);
    def(&engine, "TickCount", |_, _, o| n(o, g(|g| g.cuadro) as f64));
    // ---- util ----
    let util = lib(e, "util");
    let traza_t = |tb: &TablaRef| -> Valor {
        let cam = h(|h| h.cam().clone());
        let sp = vec_de(&tget(tb, "start")).map(a_juego).unwrap_or(cam.pos);
        let ep = vec_de(&tget(tb, "endpos")).map(a_juego).unwrap_or(sp.add(cam.fwd));
        let d = ep.sub(sp);
        let l = d.len();
        let ign = ignorar(&tget(tb, "filter"));
        if l < 1e-5 { return traza_cero(tb, sp, &ign); }
        traza(sp, d.scale(1.0 / l), l, &ign, None)
    };
    for k in ["TraceLine", "TraceHull", "TraceEntity"] { def(&util, k, move |_, a, o| match ar(a, 0) { Valor::Tabla(tb) => ok1(o, traza_t(&tb)), Valor::Nil => Err(Error::nuevo("Cannot read properties of undefined (reading 'get')")), _ => Err(Error::nuevo("t.get is not a function")) }); }
    def(&util, "QuickTrace", |_, a, o| {
        let sp = a_juego(vx(&ar(a, 0))?);
        let dd = vgr(vx(&ar(a, 1))?);
        let l = { let x = dd.len(); if x == 0.0 || x.is_nan() { 1e-6 } else { x } };
        ok1(o, traza(sp, dd.scale(1.0 / l), l, &ignorar(&ar(a, 2)), None))
    });
    def(&util, "GetPlayerTrace", |_, a, o| {
        let c = h(|h| h.cam().clone());
        let d = vec_de(&ar(a, 1)).map(|v| dg(v).norm()).unwrap_or(c.fwd);
        ok1(o, tabla_kv(vec![("start", vv(c.pos)), ("endpos", vv(c.pos.add(d.scale(32768.0 * GS)))), ("filter", g(|g| g.jug.clone()))]))
    });
    def(&util, "Effect", |e, a, _| { let nm = js_str(&ar(a, 0)); let d = efd(&ar(a, 1)); efecto(e, &nm, d); Ok(()) });
    def(&util, "BlastDamage", |_, a, _| { if let Some(p) = vec_de(&ar(a, 2)) { let r = jmax(1.0, num(&ar(a, 3), 200.0) * GS); let d = num(&ar(a, 4), 100.0); h(|h| h.explosion(a_juego(p), r, d, true)); } Ok(()) });
    def(&util, "BlastDamageInfo", |_, a, _| { if let Some(p) = vec_de(&ar(a, 1)) { let r = jmax(1.0, num(&ar(a, 2), 200.0) * GS); let d = di(&ar(a, 0), |x| mas(&x.dan)).filter(|x| *x != 0.0 && !x.is_nan()).unwrap_or(100.0); h(|h| h.explosion(a_juego(p), r, d, false)); } Ok(()) });
    def(&util, "ScreenShake", |_, a, _| { let amp = num(&ar(a, 1), 5.0); h(|h| { let c = h.cam(); c.temblor = jmax(c.temblor, jmin(1.0, amp / 20.0)); }); Ok(()) });
    for k in ["AddNetworkString", "PrecacheModel", "PrecacheSound", "Decal", "DecalEx", "ParticleTracer", "ParticleTracerEx", "SpriteTrail", "PrecacheScene"] { def(&util, k, |_, _, o| n(o, 0.0)); }
    def(&util, "DecalMaterial", |_, a, o| { let k = { let v = ar(a, 0); if js_t(&v) { js_str(&v) } else { String::new() } }.to_lowercase(); s(o, if k.contains("scorch") { "decals/scorch1" } else if k.contains("blood") { "decals/blood1" } else if k.contains("yellow") { "decals/yblood1" } else { "decals/concrete/shot1" }) });
    def(&util, "IsValidModel", |_, a, o| b(o, js_t(&ar(a, 0))));
    for k in ["IsValidProp", "IsInWorld", "IsModelLoaded", "IsSkyboxVisibleFromPoint"] { def(&util, k, |_, _, o| b(o, true)); }
    for k in ["IsValidRagdoll", "IsBoxIntersectingSphere"] { def(&util, k, |_, _, o| b(o, false)); }
    def(&util, "PointContents", |_, _, o| n(o, 0.0));
    def(&util, "TableToJSON", |_, a, o| { let mut sv = String::new(); a_json(&ar(a, 0), 0, if t(&ar(a, 1)) { 2 } else { 0 }, 0, &mut sv); ok1(o, Valor::from(sv)) });
    def(&util, "JSONToTable", |_, a, o| { let v = jxlua::bib::js_texto(&ar(a, 0)); ok1(o, de_json(&v).unwrap_or(Valor::Nil)) });
    def(&util, "Base64Encode", |_, a, o| s(o, &base64(js_str(&ar(a, 0)).as_bytes())));
    def(&util, "Base64Decode", |_, a, o| ok1(o, de_base64(&js_str(&ar(a, 0))).and_then(|v| String::from_utf8(v).ok()).map(Valor::from).unwrap_or(Valor::Nil)));
    def(&util, "CRC", |_, a, o| {
        let mut c: i32 = -1;
        for ch in js_str(&ar(a, 0)).encode_utf16() { c ^= ch as i32; for _ in 0..8 { c = if c & 1 != 0 { ((c as u32) >> 1) as i32 ^ (0xedb88320u32 as i32) } else { ((c as u32) >> 1) as i32 }; } }
        s(o, &((c ^ -1) as u32).to_string())
    });
    def(&util, "KeyValuesToTable", |_, a, o| { let txt = String::from_utf8_lossy(&jxlua::bib::js_texto(&ar(a, 0))).into_owned(); ok1(o, kv(&txt).map(|b| kv_lua(&b)).unwrap_or_else(tnueva)) });
    def(&util, "TableToKeyValues", |_, _, o| s(o, ""));
    for k in ["Compress", "Decompress", "RelativePathToFull"] { def(&util, k, |_, a, o| ok1(o, ar(a, 0))); }
    def(&util, "DistanceToLine", |_, a, o| {
        let (p0, p1, pp) = (vx(&ar(a, 0))?, vx(&ar(a, 1))?, vx(&ar(a, 2))?);
        let d = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
        let l2 = { let x = d[0] * d[0] + d[1] * d[1] + d[2] * d[2]; if x == 0.0 || x.is_nan() { 1.0 } else { x } };
        let tt = jmax(0.0, jmin(1.0, ((pp[0] - p0[0]) * d[0] + (pp[1] - p0[1]) * d[1] + (pp[2] - p0[2]) * d[2]) / l2));
        let c = [p0[0] + d[0] * tt, p0[1] + d[1] * tt, p0[2] + d[2] * tt];
        o.push(Valor::Num(js_hypot(&[pp[0] - c[0], pp[1] - c[1], pp[2] - c[2]])));
        o.push(nva(c));
        o.push(Valor::Num(tt));
        Ok(())
    });
    def(&util, "SteamIDTo64", |_, _, o| s(o, "76561197960265728"));
    def(&util, "SteamIDFrom64", |_, _, o| s(o, "STEAM_0:0:1"));
    def(&util, "NetworkStringToID", |_, _, o| n(o, 1.0));
    def(&util, "NetworkIDToString", |_, _, o| s(o, ""));
    def(&util, "GetSurfaceIndex", |_, _, o| n(o, 0.0));
    def(&util, "GetSurfaceData", |_, _, o| ok1(o, Valor::Nil));
    def(&util, "GetSurfacePropName", |_, a, o| { let i = num(&ar(a, 0), 0.0); s(o, match i as i64 { 1 if i == 1.0 => "wood", 2 if i == 2.0 => "metal", _ => "default" }) });
    def(&util, "TimerCycle", |_, _, o| n(o, 0.0));
    def(&util, "GetModelInfo", |_, a, o| {
        let m = ar(a, 0);
        let mut r = if js_t(&m) { js_str(&m) } else { String::new() }.to_lowercase().replace('\\', "/");
        if !r.starts_with("models/") { r = format!("models/{}", r); }
        let mut k = 1.0;
        if let Some(bb) = archivo(&r) { if bb.len() > 232 { let v = i32::from_le_bytes([bb[224], bb[225], bb[226], bb[227]]); if (1..256).contains(&v) { k = v as f64; } } }
        ok1(o, tabla_kv(vec![("SkinCount", Valor::Num(k)), ("KeyValues", cad("")), ("ModelKeyValues", cad(""))]))
    });
    def(&util, "GetModelMeshes", |_, _, o| ok1(o, tnueva()));
    def(&util, "AimVector", |_, _, o| ok1(o, vvd(h(|h| h.cam().fwd))));
    def(&util, "SharedRandom", |e, a, o| { let lo = num(&ar(a, 1), 0.0); let hi = num(&ar(a, 2), 1.0); let r = e.azar(); n(o, lo + r * (hi - lo)) });
    let l2w = fnat(|_, a, o| {
        let q = ang_quat(ang_de(&ar(a, 3)).unwrap_or([f64::NAN; 3]));
        let p = a_juego(vx(&ar(a, 2))?).add(q.rot(vgr(vx(&ar(a, 0))?)));
        o.push(vv(p));
        o.push(naa(quat_ang(Quat::mul_to(q, ang_quat(ang_de(&ar(a, 1)).unwrap_or([f64::NAN; 3]))))));
        Ok(())
    });
    util.borrow_mut().set_str("LocalToWorld", l2w.clone());
    gl.borrow_mut().set_str("LocalToWorld", l2w);
    def(&gl, "WorldToLocal", |_, a, o| {
        let q = ang_quat(ang_de(&ar(a, 3)).unwrap_or([f64::NAN; 3])).conj();
        o.push(vvr(q.rot(a_juego(vx(&ar(a, 0))?).sub(a_juego(vx(&ar(a, 2))?)))));
        o.push(naa(quat_ang(Quat::mul_to(q, ang_quat(ang_de(&ar(a, 1)).unwrap_or([f64::NAN; 3]))))));
        Ok(())
    });
    // ---- timer ----
    let timer = lib(e, "timer");
    let tk = |id: &Valor| format!("{}:{}", ctx().letra(), js_str(id));
    let tget2 = move |id: &Valor| { let k = tk(id); g(|g| g.timers.iter().find(|x| x.0 == k).map(|x| x.1.clone())) };
    def(&timer, "Create", move |_, a, o| {
        let k = tk(&ar(a, 0));
        let d = num(&ar(a, 1), 0.0);
        let tm = Timer { d, r: num(&ar(a, 2), 1.0), f: ar(a, 3), t: tiempo() + d, ctx: ctx(), pausa: false, resta: None };
        g(|g| match g.timers.iter().position(|x| x.0 == k) { Some(i) => g.timers[i].1 = Rc::new(RefCell::new(tm)), None => g.timers.push((k, Rc::new(RefCell::new(tm)))) });
        b(o, true)
    });
    def(&timer, "Simple", |_, a, _| {
        let f = ar(a, 1);
        if matches!(f, Valor::Func(_) | Valor::Tabla(_)) { let tt = tiempo() + num(&ar(a, 0), 0.0); let c = ctx(); g(|g| g.t_simples.push(TSimple { t: tt, f: Accion::Lua(f, Vec::new()), ctx: c })); }
        Ok(())
    });
    for k in ["Remove", "Destroy"] { def(&timer, k, move |_, a, _| { let k = tk(&ar(a, 0)); g(|g| g.timers.retain(|x| x.0 != k)); Ok(()) }); }
    for k in ["Exists", "IsTimer"] { def(&timer, k, move |_, a, o| { let k = tk(&ar(a, 0)); b(o, g(|g| g.timers.iter().any(|x| x.0 == k))) }); }
    def(&timer, "Adjust", move |_, a, o| {
        let Some(tm) = tget2(&ar(a, 0)) else { return b(o, false) };
        let mut x = tm.borrow_mut();
        x.d = num(&ar(a, 1), x.d);
        if !ar(a, 2).es_nil() { x.r = num(&ar(a, 2), x.r); }
        if t(&ar(a, 3)) { x.f = ar(a, 3); }
        x.t = tiempo() + x.d;
        b(o, true)
    });
    def(&timer, "Start", move |_, a, o| { let tm = tget2(&ar(a, 0)); if let Some(tm) = &tm { let mut x = tm.borrow_mut(); x.t = tiempo() + x.d; x.pausa = false; } b(o, tm.is_some()) });
    def(&timer, "Stop", move |_, a, o| { let tm = tget2(&ar(a, 0)); if let Some(tm) = &tm { tm.borrow_mut().pausa = true; } b(o, tm.is_some()) });
    def(&timer, "Pause", move |_, a, o| { let tm = tget2(&ar(a, 0)); if let Some(tm) = &tm { let mut x = tm.borrow_mut(); x.pausa = true; x.resta = Some(x.t - tiempo()); } b(o, tm.is_some()) });
    def(&timer, "UnPause", move |_, a, o| { let tm = tget2(&ar(a, 0)); if let Some(tm) = &tm { let mut x = tm.borrow_mut(); x.pausa = false; if let Some(r) = x.resta { x.t = tiempo() + r; } } b(o, tm.is_some()) });
    def(&timer, "Toggle", move |_, a, o| { let tm = tget2(&ar(a, 0)); if let Some(tm) = &tm { let mut x = tm.borrow_mut(); x.pausa = !x.pausa; } b(o, tm.map(|x| !x.borrow().pausa).unwrap_or(false)) });
    def(&timer, "TimeLeft", move |_, a, o| ok1(o, tget2(&ar(a, 0)).map(|x| Valor::Num(x.borrow().t - tiempo())).unwrap_or(Valor::Nil)));
    def(&timer, "RepsLeft", move |_, a, o| ok1(o, tget2(&ar(a, 0)).map(|x| Valor::Num(x.borrow().r)).unwrap_or(Valor::Nil)));
    def(&timer, "Check", nada);
    // ---- hook ----
    let hook_t = lib(e, "hook");
    def(&hook_t, "Add", |_, a, _| {
        let (ev, id, f) = (ar(a, 0), ar(a, 1), ar(a, 2));
        let Valor::Cad(ev) = ev else { return Ok(()) };
        if id.es_nil() || !matches!(f, Valor::Func(_)) { return Ok(()); }
        let ev = ev.texto().into_owned();
        let c = ctx();
        g(|g| {
            let addon = g.addon_actual.as_ref().map(|a| a.borrow().id.clone()).or_else(|| g.hook_addon.clone());
            if !g.hooks.has(&ev) { g.hooks.set(&ev, Vec::new()); }
            let hs = g.hooks.get_mut(&ev).unwrap();
            let i = match hs.iter().position(|x| x.0.crudo_igual(&id)) { Some(i) => i, None => { hs.push((id, Hook { s: None, c: None, a: None, ns: 0, nc: 0 })); hs.len() - 1 } };
            let hk = &mut hs[i].1;
            if c == Lado::S { hk.s = Some(f); hk.ns = 0; } else { hk.c = Some(f); hk.nc = 0; }
            hk.a = addon.or(hk.a.take());
        });
        Ok(())
    });
    def(&hook_t, "Remove", |_, a, _| {
        let Valor::Cad(ev) = ar(a, 0) else { let ev = js_str(&ar(a, 0)); let _ = ev; return Ok(()) };
        let id = ar(a, 1);
        let c = ctx();
        g(|g| if let Some(hs) = g.hooks.get_mut(&ev.texto()) {
            if let Some(i) = hs.iter().position(|x| x.0.crudo_igual(&id)) {
                let hk = &mut hs[i].1;
                if c == Lado::S { hk.s = None; } else { hk.c = None; }
                if hk.s.is_none() && hk.c.is_none() { hs.remove(i); }
            }
        });
        Ok(())
    });
    def(&hook_t, "Run", |e, a, o| { let ev = js_str(&ar(a, 0)); let c = ctx(); o.extend(hook(e, &ev, &[c], &a[1.min(a.len())..])); Ok(()) });
    def(&hook_t, "Call", |e, a, o| {
        let ev = js_str(&ar(a, 0));
        let c = ctx();
        let r = hook(e, &ev, &[c], &a[2.min(a.len())..]);
        if !r.is_empty() && !r[0].es_nil() { o.extend(r); return Ok(()); }
        if let Valor::Tabla(gm) = ar(a, 1) {
            let f = gm.borrow().get(&ar(a, 0));
            if let Valor::Func(_) = f { let mut v = vec![Valor::Tabla(gm.clone())]; v.extend_from_slice(&a[2.min(a.len())..]); o.extend(e.llamar_aqui(&f, &v)?); }
        }
        Ok(())
    });
    def(&hook_t, "GetTable", |_, _, o| {
        let c = ctx();
        let t0 = Tabla::nueva_ref();
        g(|g| for (ev, hs) in &g.hooks.v {
            let st = Tabla::nueva_ref();
            for (id, hk) in hs { if let Some(f) = if c == Lado::S { &hk.s } else { &hk.c } { let _ = st.borrow_mut().set(id.clone(), f.clone()); } }
            t0.borrow_mut().set_str(ev, Valor::Tabla(st));
        });
        ok1(o, Valor::Tabla(t0))
    });
    // ---- concommand y cvars ----
    let cc = lib(e, "concommand");
    let cvars = lib(e, "cvars");
    def(&cc, "Add", |_, a, _| { let nm = js_str(&ar(a, 0)); let c = ctx(); let f = ar(a, 1); g(|g| g.cmds.insert(nm, (f, c))); Ok(()) });
    def(&cc, "Remove", |_, a, _| { let nm = js_str(&ar(a, 0)); g(|g| g.cmds.remove(&nm)); Ok(()) });
    def(&cc, "Run", |e, a, _| {
        let nm = js_str(&ar(a, 1));
        let resto = match ar(a, 2) { Valor::Tabla(t) => lista(&t).iter().map(js_str).collect::<Vec<_>>().join(" "), _ => String::new() };
        consola2(e, &format!("{} {}", nm, resto));
        Ok(())
    });
    def(&cc, "GetTable", |_, _, o| ok1(o, tnueva()));
    def(&cvars, "AddChangeCallback", |_, a, _| {
        let nm = js_str(&ar(a, 0));
        cvar(&nm, Some("0".into()), Valor::Nil, Valor::Nil, Valor::Nil);
        let c = ctx();
        let f = ar(a, 1);
        if let Some(x) = g(|g| g.cvars.get(&nm).cloned()) { x.borrow_mut().cbs.push((f, c)); }
        Ok(())
    });
    def(&cvars, "RemoveChangeCallback", nada);
    def(&cvars, "Number", |_, a, o| { let k = ar(a, 0); let c = if let Valor::Cad(s) = &k { g(|g| g.cvars.get(&*s.texto()).cloned()) } else { None }; ok1(o, match c { Some(c) => { let v = cad(&c.borrow().v); Valor::Num(num(&v, num(&ar(a, 1), f64::NAN))) } None => ar(a, 1) }) });
    def(&cvars, "String", |_, a, o| { let k = ar(a, 0); let c = if let Valor::Cad(s) = &k { g(|g| g.cvars.get(&*s.texto()).cloned()) } else { None }; ok1(o, match c { Some(c) => cad(&c.borrow().v), None => ar(a, 1) }) });
    def(&cvars, "Bool", |_, a, o| { let k = ar(a, 0); let c = if let Valor::Cad(s) = &k { g(|g| g.cvars.get(&*s.texto()).cloned()) } else { None }; ok1(o, match c { Some(c) => { let x = num(&cad(&c.borrow().v), 0.0); Valor::Bool(x != 0.0 && !x.is_nan()) } None => ar(a, 1) }) });
    def(&cvars, "GetConVarCallbacks", |_, _, o| ok1(o, tnueva()));
    // ---- net ----
    let net = lib(e, "net");
    def(&net, "Start", |_, a, o| { let nm = js_str(&ar(a, 0)).to_lowercase(); let c = ctx(); g(|g| g.saliente = Some(NetMsg { n: nm, v: Vec::new(), lado: c })); b(o, true) });
    for tp in ["String", "Int", "UInt", "Float", "Double", "Bool", "Entity", "Vector", "Angle", "Table", "Color", "Data", "Bit", "Normal", "Type", "Matrix", "UInt64", "Player"] {
        def(&net, &format!("Write{}", tp), |_, a, _| { let v = ar(a, 0); g(|g| if let Some(m) = &mut g.saliente { m.v.push(v); }); Ok(()) });
        let tp2 = tp.to_string();
        def(&net, &format!("Read{}", tp), move |e, _, o| {
            let Some(v) = g(|g| g.lectura.as_mut().map(|(v, i)| { let x = v.get(*i).cloned().unwrap_or(Valor::Nil); *i += 1; x })) else { return ok1(o, Valor::Nil) };
            let tp = tp2.as_str();
            if tp == "Bit" { return n(o, if t(&v) && !matches!(v, Valor::Num(x) if x == 0.0) { 1.0 } else { 0.0 }); }
            if tp == "Bool" { return b(o, t(&v) && !matches!(v, Valor::Num(x) if x == 0.0)); }
            if tp.contains("Int") || tp.contains("Float") || tp.contains("Double") { return n(o, match v { Valor::Num(x) => x, _ => Estado::a_numero(&v).unwrap_or(0.0) }); }
            if tp == "String" || tp == "Data" { return ok1(o, match &v { Valor::Nil => cad(""), Valor::Cad(_) => v.clone(), _ => Valor::Cad(e.tostring(&v)?) }); }
            ok1(o, if !v.es_nil() { v } else if tp == "Entity" || tp == "Player" { null() } else { Valor::Nil })
        });
    }
    let enviar = |lado: Lado| g(|g| if let Some(mut m) = g.saliente.take() { m.lado = lado; g.net_cola.push(m); });
    for k in ["Send", "Broadcast", "SendOmit", "SendPVS", "SendPAS"] { def(&net, k, move |_, _, _| { enviar(Lado::C); Ok(()) }); }
    def(&net, "SendToServer", move |_, _, _| { enviar(Lado::S); Ok(()) });
    let receptores = Tabla::nueva_ref(); net.borrow_mut().set_str("Receivers", Valor::Tabla(receptores.clone()));
    // (net.Receivers: la tabla de los que reciben, como en GMod —los addons la miran y la envuelven—)
    def(&net, "Receive", move |_, a, _| { let nm = js_str(&ar(a, 0)).to_lowercase(); let f = ar(a, 1); let _ = receptores.borrow_mut().set(cad(&nm), f.clone()); let c = ctx(); g(|g| if c == Lado::C { g.net_c.insert(nm, f); } else { g.net_s.insert(nm, f); }); Ok(()) });
    def(&net, "Incoming", nada);
    def(&net, "BytesWritten", |_, _, o| n(o, g(|g| g.saliente.as_ref().map(|m| m.v.len() * 4).unwrap_or(0)) as f64));
    def(&net, "BytesLeft", |_, _, o| n(o, g(|g| g.lectura.as_ref().map(|(v, i)| (v.len() as f64 - *i as f64) * 4.0).unwrap_or(0.0))));
    def(&net, "Abort", |_, _, _| { g(|g| g.saliente = None); Ok(()) });
    // ---- umsg ----
    let umsg = lib(e, "umsg");
    let usm = lib(e, "usermessage");
    def(&umsg, "Start", |_, a, _| { let nm = js_str(&ar(a, 0)); g(|g| g.um = Some((nm, Vec::new()))); Ok(()) });
    for k in ["String", "Long", "Short", "Float", "Bool", "Entity", "Vector", "Angle", "Char", "VectorNormal"] { def(&umsg, k, |_, a, _| { let v = ar(a, 0); g(|g| if let Some(m) = &mut g.um { m.1.push(v); }); Ok(()) }); }
    def(&umsg, "End", |_, _, _| {
        let Some((nm, v)) = g(|g| g.um.take()) else { return Ok(()) };
        if let Some(f) = g(|g| g.umsg_h.get(&nm).cloned()) {
            let fr: Box<dyn FnOnce(&mut Estado)> = Box::new(move |e| {
                let mt = g(|g| g.mt.um.clone());
                let l = Valor::Udata(Udata::nueva(RefCell::new((v, 0usize)), mt));
                llamar(e, &f, Lado::C, &[l]);
            });
            g(|gg| gg.t_simples.push(TSimple { t: 0.0, f: Accion::Rust(fr), ctx: Lado::C }));
        }
        Ok(())
    });
    def(&umsg, "PoolString", nada);
    def(&usm, "Hook", |_, a, _| { let nm = js_str(&ar(a, 0)); let f = ar(a, 1); g(|g| g.umsg_h.insert(nm, f)); Ok(()) });
    def(&usm, "GetTable", |_, _, o| ok1(o, tnueva()));
    {
        let umm = Tabla::nueva_ref();
        let umi = Tabla::nueva_ref();
        umm.borrow_mut().set_str("__index", Valor::Tabla(umi.clone()));
        for k in ["String", "Long", "Short", "Float", "Bool", "Entity", "Vector", "Angle", "Char", "VectorNormal"] {
            def(&umi, &format!("Read{}", k), |_, a, o| { let v = match &ar(a, 0) { Valor::Udata(u) => u.con(|x: &RefCell<(Vec<Valor>, usize)>| { let mut b = x.borrow_mut(); let v = b.0.get(b.1).cloned().unwrap_or(Valor::Nil); b.1 += 1; v }), _ => None }; ok1(o, v.unwrap_or(Valor::Nil)) });
        }
        def(&umi, "Reset", |_, a, _| { if let Valor::Udata(u) = &ar(a, 0) { u.con(|x: &RefCell<(Vec<Valor>, usize)>| x.borrow_mut().1 = 0); } Ok(()) });
        g(|g| g.mt.um = Some(umm));
    }
    // ---- sound ----
    let sound = lib(e, "sound");
    def(&sound, "Add", |_, a, _| {
        let Valor::Tabla(tb) = ar(a, 0) else { return Ok(()) };
        let nm = { let v = tget(&tb, "name"); if js_t(&v) { js_str(&v) } else { String::new() } }.to_lowercase();
        let w = tget(&tb, "sound");
        let l: Vec<String> = match &w { Valor::Tabla(t) => lista(t).iter().map(js_str).collect(), _ => vec![if js_t(&w) { js_str(&w) } else { String::new() }] };
        let v = tget(&tb, "volume");
        let p = tget(&tb, "pitch");
        let vv2 = match &v { Valor::Num(_) => v.clone(), Valor::Tabla(t) => t.borrow().get_int(1), _ => Valor::Num(1.0) };
        let pv = match &p { Valor::Num(_) => p.clone(), Valor::Tabla(t) => Valor::Num((mas(&t.borrow().get_int(1)) + mas(&t.borrow().get_int(2))) / 2.0), _ => Valor::Num(100.0) };
        g(|g| g.guiones.insert(nm, (l, vv2, pv)));
        Ok(())
    });
    def(&sound, "Play", |e, a, _| { let sn = js_str(&ar(a, 0)); let p = vec_de(&ar(a, 1)).map(a_juego); sonar(e, &sn, p, ar(a, 4), ar(a, 3)); Ok(()) });
    for k in ["PlayFile", "PlayURL", "Generate"] { def(&sound, k, nada); }
    def(&sound, "GetTable", |_, _, o| { let mut v: Vec<String> = g(|g| g.guiones.keys().cloned().collect()); v.sort(); ok1(o, tab_de(v.iter().map(|x| cad(x)).collect())) });
    def(&sound, "GetProperties", |_, _, o| ok1(o, Valor::Nil));
    {
        let snm = Tabla::nueva_ref();
        let sni = Tabla::nueva_ref();
        snm.borrow_mut().set_str("__index", Valor::Tabla(sni.clone()));
        fn pa(v: &Valor) -> Option<(u32, Option<f64>, String, Option<f64>, Option<f64>)> {
            let opt = |x: &Valor| if x.es_nil() { None } else { Some(mas(x)) };
            match v { Valor::Udata(u) => u.con(|p: &Parche| (p.id, ent_id(&p.e).map(|x| x as f64), js_str(&p.s), opt(&p.vol), opt(&p.tono))), _ => None }
        }
        fn parche(v: &Valor, on: bool, fade: Option<f64>) {
            if let Valor::Udata(u) = v { u.con_mut(|p: &mut Parche| p.on = on); }
            if let Some((id, e, s, vol, tono)) = pa(v) { h(|h| h.parche_sonido(id, e, &s, on, vol, tono, fade)); }
        }
        def(&sni, "Play", |_, a, _| { parche(&ar(a, 0), true, None); Ok(()) });
        let sni2 = Rc::downgrade(&sni);
        def(&sni, "PlayEx", move |e, a, _| { let x = ar(a, 0); if let Valor::Udata(u) = &x { u.con_mut(|p: &mut Parche| { p.vol = ar(a, 1); p.tono = ar(a, 2); }); } if let Some(t2) = sni2.upgrade() { let f = t2.borrow().get_str("Play"); e.llamar_aqui(&f, &[x])?; } Ok(()) });
        def(&sni, "Stop", |_, a, _| { parche(&ar(a, 0), false, None); Ok(()) });
        def(&sni, "FadeOut", |_, a, _| { parche(&ar(a, 0), false, Some(num(&ar(a, 1), 0.0))); Ok(()) });
        def(&sni, "IsPlaying", |_, a, o| b(o, match &ar(a, 0) { Valor::Udata(u) => u.con(|p: &Parche| p.on).unwrap_or(false), _ => false }));
        // (el volumen y el tono de un bucle que suena cambian al momento: la web los lee del parche en cada cuadro)
        def(&sni, "ChangeVolume", |_, a, _| { let x = ar(a, 0); if let Valor::Udata(u) = &x { u.con_mut(|p: &mut Parche| p.vol = ar(a, 1)); if u.con(|p: &Parche| p.on).unwrap_or(false) { parche(&x, true, None); } } Ok(()) });
        def(&sni, "ChangePitch", |_, a, _| { let x = ar(a, 0); if let Valor::Udata(u) = &x { u.con_mut(|p: &mut Parche| p.tono = ar(a, 1)); if u.con(|p: &Parche| p.on).unwrap_or(false) { parche(&x, true, None); } } Ok(()) });
        for k in ["SetSoundLevel", "SetDSP"] { def(&sni, k, nada); }
        def(&sni, "GetVolume", |_, a, o| ok1(o, match &ar(a, 0) { Valor::Udata(u) => u.con(|p: &Parche| p.vol.clone()).unwrap_or(Valor::Nil), _ => Valor::Nil }));
        def(&sni, "GetPitch", |_, a, o| ok1(o, match &ar(a, 0) { Valor::Udata(u) => u.con(|p: &Parche| p.tono.clone()).unwrap_or(Valor::Nil), _ => Valor::Nil }));
        def(&sni, "GetSoundLevel", |_, _, o| n(o, 75.0));
        g(|g| g.mt.snd = Some(snm));
    }
    crate::resto::instalar_luces(e);
    crate::dibujo::instalar(e);
    // ---- efectos, daño, partículas ----
    {
        let efm = Tabla::nueva_ref();
        let efi = Tabla::nueva_ref();
        efm.borrow_mut().set_str("__index", Valor::Tabla(efi.clone()));
        for k in ["Origin", "Start", "Normal", "Angles", "Entity", "Magnitude", "Scale", "Radius", "Flags", "Color", "Attachment", "SurfaceProp", "DamageType", "HitBox", "MaterialIndex", "EntIndex"] {
            def(&efi, &format!("Set{}", k), move |_, a, _| { if let Some(d) = efd(&ar(a, 0)) { d.borrow_mut().set_str(k, ar(a, 1)); } Ok(()) });
            def(&efi, &format!("Get{}", k), move |_, a, o| {
                let v = efd(&ar(a, 0)).map(|d| tget(&d, k)).unwrap_or(Valor::Nil);
                ok1(o, if !v.es_nil() { v } else if k == "Entity" { null() } else if k == "Origin" || k == "Start" || k == "Normal" { nv(0.0, 0.0, 0.0) } else if k == "Angles" { na(0.0, 0.0, 0.0) } else { Valor::Num(0.0) })
            });
        }
        g(|g| g.mt.efecto = Some(efm));
        let dmm = Tabla::nueva_ref();
        let dmi = Tabla::nueva_ref();
        dmm.borrow_mut().set_str("__index", Valor::Tabla(dmi.clone()));
        let d0 = |a: &[Valor]| ar(a, 0);
        def(&dmi, "GetDamage", move |_, a, o| ok1(o, di(&d0(a), |x| x.dan.clone()).unwrap_or(Valor::Nil)));
        def(&dmi, "SetDamage", move |_, a, _| { let v = num(&ar(a, 1), 0.0); di(&d0(a), |x| x.dan = Valor::Num(v)); Ok(()) });
        def(&dmi, "AddDamage", move |_, a, _| { let v = num(&ar(a, 1), 0.0); di(&d0(a), |x| x.dan = Valor::Num(mas(&x.dan) + v)); Ok(()) });
        def(&dmi, "SubtractDamage", move |_, a, _| { let v = num(&ar(a, 1), 0.0); di(&d0(a), |x| x.dan = Valor::Num(mas(&x.dan) - v)); Ok(()) });
        def(&dmi, "ScaleDamage", move |_, a, _| { let v = num(&ar(a, 1), 1.0); di(&d0(a), |x| x.dan = Valor::Num(mas(&x.dan) * v)); Ok(()) });
        def(&dmi, "GetAttacker", move |_, a, o| ok1(o, di(&d0(a), |x| x.at.clone()).unwrap_or(Valor::Nil)));
        def(&dmi, "SetAttacker", move |_, a, _| { di(&d0(a), |x| x.at = ar(a, 1)); Ok(()) });
        def(&dmi, "GetInflictor", move |_, a, o| ok1(o, di(&d0(a), |x| x.inf.clone()).unwrap_or(Valor::Nil)));
        def(&dmi, "SetInflictor", move |_, a, _| { di(&d0(a), |x| x.inf = ar(a, 1)); Ok(()) });
        def(&dmi, "GetDamageType", move |_, a, o| ok1(o, di(&d0(a), |x| x.tipo.clone()).unwrap_or(Valor::Nil)));
        def(&dmi, "SetDamageType", move |_, a, _| { di(&d0(a), |x| x.tipo = ar(a, 1)); Ok(()) });
        let bit = |a: &[Valor], k: i32| di(&ar(a, 0), |x| i32_de(mas(&x.tipo)) & k != 0).unwrap_or(false);
        def(&dmi, "IsDamageType", move |_, a, o| b(o, bit(a, i32_de(mas(&ar(a, 1))))));
        def(&dmi, "IsExplosionDamage", move |_, a, o| b(o, bit(a, 64)));
        def(&dmi, "IsBulletDamage", move |_, a, o| b(o, bit(a, 2)));
        def(&dmi, "IsFallDamage", move |_, a, o| b(o, bit(a, 32)));
        for k in ["GetDamagePosition", "GetReportedPosition"] { def(&dmi, k, move |_, a, o| { let v = di(&d0(a), |x| x.pos.clone()).unwrap_or(Valor::Nil); ok1(o, if js_t(&v) { v } else { nv(0.0, 0.0, 0.0) }) }); }
        def(&dmi, "SetDamagePosition", move |_, a, _| { di(&d0(a), |x| x.pos = ar(a, 1)); Ok(()) });
        def(&dmi, "GetDamageForce", move |_, a, o| { let v = di(&d0(a), |x| x.fuerza.clone()).unwrap_or(Valor::Nil); ok1(o, if js_t(&v) { v } else { nv(0.0, 0.0, 0.0) }) });
        def(&dmi, "SetDamageForce", move |_, a, _| { di(&d0(a), |x| x.fuerza = ar(a, 1)); Ok(()) });
        for k in ["GetMaxDamage", "GetBaseDamage"] { def(&dmi, k, move |_, a, o| ok1(o, di(&d0(a), |x| x.dan.clone()).unwrap_or(Valor::Nil))); }
        for k in ["SetReportedPosition", "SetMaxDamage", "SetAmmoType", "SetDamageBonus", "SetDamageCustom"] { def(&dmi, k, nada); }
        def(&dmi, "GetAmmoType", |_, _, o| n(o, 1.0));
        for k in ["GetDamageBonus", "GetDamageCustom"] { def(&dmi, k, |_, _, o| n(o, 0.0)); }
        g(|g| g.mt.dmg = Some(dmm));
        let pem = Tabla::nueva_ref();
        let pei = Tabla::nueva_ref();
        pem.borrow_mut().set_str("__index", Valor::Tabla(pei.clone()));
        def(&pei, "Add", |_, a, o| {
            let mat = { let v = ar(a, 1); if js_t(&v) { js_str(&v) } else { String::new() } };
            let p = match vec_de(&ar(a, 2)) { Some(v) => a_juego(v), None => { let ep = match &ar(a, 0) { Valor::Udata(u) => u.con(|x: &Emisor| vec_de(&x.0)).flatten(), _ => None }; a_juego(ep.unwrap_or([0.0; 3])) } };
            let mt = g(|g| g.mt.part.clone());
            let q = Valor::Udata(Udata::nueva(Part { mat, p, v: V3::default(), vida: 1.0, t0: 10.0, t1: 0.0, a0: 255.0, a1: 0.0, c: [255.0; 3], g: V3::default() }, mt));
            g(|g| g.part_cola.push(q.clone()));
            ok1(o, q)
        });
        for k in ["Finish", "SetNearClip", "SetNoDraw", "SetPos", "SetBBox", "Draw"] { def(&pei, k, nada); }
        def(&pei, "GetNumActiveParticles", |_, _, o| n(o, 0.0));
        def(&pei, "Is3D", |_, _, o| b(o, false));
        def(&pei, "IsValid", |_, _, o| b(o, true));
        g(|g| g.mt.emisor = Some(pem));
        let ptm = Tabla::nueva_ref();
        let pti = Tabla::nueva_ref();
        ptm.borrow_mut().set_str("__index", Valor::Tabla(pti.clone()));
        fn pq(a: &[Valor], f: impl FnOnce(&mut Part)) { if let Valor::Udata(u) = &ar(a, 0) { u.con_mut(f); } }
        def(&pti, "SetVelocity", |_, a, _| { let v = vgr(vec_de(&ar(a, 1)).unwrap_or([f64::NAN; 3])); pq(a, |q| q.v = v); Ok(()) });
        def(&pti, "SetDieTime", |_, a, _| { let v = num(&ar(a, 1), 1.0); pq(a, |q| q.vida = v); Ok(()) });
        def(&pti, "SetLifeTime", nada);
        def(&pti, "SetStartSize", |_, a, _| { let v = num(&ar(a, 1), 10.0); pq(a, |q| q.t0 = v); Ok(()) });
        def(&pti, "SetEndSize", |_, a, _| { let v = num(&ar(a, 1), 0.0); pq(a, |q| q.t1 = v); Ok(()) });
        def(&pti, "SetStartAlpha", |_, a, _| { let v = num(&ar(a, 1), 255.0); pq(a, |q| q.a0 = v); Ok(()) });
        def(&pti, "SetEndAlpha", |_, a, _| { let v = num(&ar(a, 1), 0.0); pq(a, |q| q.a1 = v); Ok(()) });
        def(&pti, "SetColor", |_, a, _| { let c = [num(&ar(a, 1), 255.0), num(&ar(a, 2), 255.0), num(&ar(a, 3), 255.0)]; pq(a, |q| q.c = c); Ok(()) });
        def(&pti, "SetGravity", |_, a, _| { let v = vgr(vec_de(&ar(a, 1)).unwrap_or([f64::NAN; 3])); pq(a, |q| q.g = v); Ok(()) });
        def(&pti, "GetPos", |_, a, o| ok1(o, match &ar(a, 0) { Valor::Udata(u) => u.con(|q: &Part| q.p).map(vv).unwrap_or(Valor::Nil), _ => Valor::Nil }));
        def(&pti, "SetPos", |_, a, _| { let p = a_juego(vec_de(&ar(a, 1)).unwrap_or([f64::NAN; 3])); pq(a, |q| q.p = p); Ok(()) });
        def(&pti, "GetVelocity", |_, a, o| ok1(o, match &ar(a, 0) { Valor::Udata(u) => u.con(|q: &Part| q.v).map(vvr).unwrap_or(Valor::Nil), _ => Valor::Nil }));
        for k in ["SetRoll", "SetRollDelta", "SetAirResistance", "SetCollide", "SetBounce", "SetLighting", "SetAngles", "SetAngleVelocity", "SetStartLength", "SetEndLength", "SetCollideCallback", "SetThinkFunction", "SetNextThink", "SetVelocityScale", "SetMaterial"] { def(&pti, k, nada); }
        g(|g| g.mt.part = Some(ptm));
        let vac = Tabla::nueva_ref();
        def(&vac, "__index", |_, a, o| {
            let x = ar(a, 0);
            let pregunta = matches!(ar(a, 1), Valor::Cad(c) if c.bytes().starts_with(b"Get") || c.bytes().starts_with(b"Is") || c.bytes().starts_with(b"Has"));
            ok1(o, if pregunta { fnat(|_, _, o| n(o, 0.0)) } else { fnat(move |_, _, o| ok1(o, x.clone())) })
        });
        g(|g| g.mt.vacio = Some(vac));
    }
    for k in ["render", "cam", "mesh", "killicon", "resource", "spawnmenu", "presets", "undo", "cleanup", "duplicator", "constraint", "properties", "achievements", "navmesh", "steamworks", "search", "menubar", "widgets", "halo", "frame_blend", "drive", "construct", "numpad", "matproxy", "motionsensor", "controlpanel", "serverlist", "video", "jit", "ai", "ai_schedule", "ai_task", "system", "http", "gui", "input", "chat", "notification", "gamemode", "team", "player_manager", "physenv", "language", "list", "file", "sql", "effects", "scripted_ents", "weapons", "baseclass", "cookie", "utf8"] { lib(e, k); }
    jxlua::bib::utf8::abrir(e);
    crate::resto::instalar(e);
    let _ = color;
    let _ = colorf;
}

/// GMA_ARMA_SUELO: las armas de HL2 que se pueden tirar al piso (su modelo de mundo)
fn arma_suelo_modelo(c: &str) -> Option<&'static str> {
    Some(match c {
        "weapon_pistol" => "models/weapons/w_pistol.mdl", "weapon_357" => "models/weapons/w_357.mdl", "weapon_smg1" => "models/weapons/w_smg1.mdl", "weapon_ar2" => "models/weapons/w_irifle.mdl",
        "weapon_shotgun" => "models/weapons/w_shotgun.mdl", "weapon_crossbow" => "models/weapons/w_crossbow.mdl", "weapon_rpg" => "models/weapons/w_rocket_launcher.mdl", "weapon_crowbar" => "models/weapons/w_crowbar.mdl",
        "weapon_frag" => "models/weapons/w_grenade.mdl", "weapon_stunstick" => "models/weapons/w_stunbaton.mdl", "weapon_physcannon" => "models/weapons/w_physics.mdl", "weapon_slam" => "models/weapons/w_slam.mdl", "weapon_bugbait" => "models/weapons/w_bugbait.mdl",
        _ => return None,
    })
}
/// un patrón con * (sin distinguir mayúsculas; los dos ya en minúsculas)
fn glob(p: &str, s: &str) -> bool {
    let (p, s) = (p.as_bytes(), s.as_bytes());
    let (mut i, mut j, mut est, mut mk) = (0usize, 0usize, None::<usize>, 0usize);
    while j < s.len() {
        if i < p.len() && p[i] != b'*' && p[i] == s[j] { i += 1; j += 1; }
        else if i < p.len() && p[i] == b'*' { est = Some(i); mk = j; i += 1; }
        else if let Some(e) = est { i = e + 1; mk += 1; j = mk; }
        else { return false; }
    }
    while i < p.len() && p[i] == b'*' { i += 1; }
    i == p.len()
}
/// las entidades vivas (todos(): también los objetos del juego y los puntos de aparición)
pub(crate) fn todos() -> Vec<Valor> {
    for o in h(|h| h.objetos()) { ent_de_obj(o); }
    apariciones();
    g(|g| g.ents_vivas()).into_iter().filter(|x| ce(x, |y| y.vivo && y.tipo != TipoEnt::Vm).unwrap_or(false) && { let o = ce(x, |y| if y.tipo == TipoEnt::Ent { y.o } else { None }).flatten(); o.map(|o| cuerpo(o, |_| ()).is_some()).unwrap_or(true) }).collect()
}
fn apariciones() {
    if g(|g| g.apar.is_some()) { return; }
    let l = h(|h| h.apariciones());
    let v: Vec<Valor> = l.into_iter().map(|(p, yaw)| { let x = nueva_ent("info_player_start", TipoEnt::Ent); ce(&x, |y| { y.pos = p; if let Some(yw) = yaw { y.q = Quat::axis(0.0, 1.0, 0.0, yw); } y.modelo = String::new(); }); x }).collect();
    g(|g| g.apar = Some(v));
}
/// la traza de largo cero: ¿esto está tocando algo?
fn traza_cero(tb: &TablaRef, sp: V3, ign: &[ObjId]) -> Valor {
    let f = tget(tb, "filter");
    let l: Vec<Valor> = match &f { Valor::Tabla(t) => t.borrow().pares().into_iter().map(|x| x.1).collect(), x => vec![x.clone()] };
    let en = l.into_iter().find(|x| ce(x, |y| y.pos_antes.is_some() && y.vivo).unwrap_or(false) && ent_pos(x).sub(sp).len() < 0.01);
    if let Some(en) = en {
        let pa = ce(&en, |y| y.pos_antes).flatten().unwrap();
        let d = sp.sub(pa);
        let nn = d.len();
        if nn > 1e-4 && nn < 5.0 { let r = traza(pa, d.scale(1.0 / nn), nn, ign, None); if let Valor::Tabla(t) = &r { if t.borrow().get_str("Hit").es_verdad() { return r; } } }
    }
    let mx = vec_de(&tget(tb, "maxs"));
    let ex = mx.map(|m| m[0].abs().max(m[1].abs()).max(m[2].abs()) * GS).unwrap_or(0.0);
    let hh = jmax(ex, 0.02);
    traza(sp.add(v3(0.0, hh, 0.0)), v3(0.0, -1.0, 0.0), 2.0 * hh, ign, None)
}
// ---------------- KeyValues (GMF.kv de la web) ----------------
enum KvVal { S(String), T(Vec<(String, KvVal)>) }
enum Tok { Abre, Cierra, S(String, bool) }
fn kv(txt: &str) -> Option<Vec<(String, KvVal)>> {
    let c: Vec<char> = txt.chars().collect();
    let n = c.len();
    let mut i = 0usize;
    let tok = |i: &mut usize| -> Option<Tok> {
        loop {
            while *i < n && c[*i].is_whitespace() { *i += 1; }
            if *i + 1 < n && c[*i] == '/' && c[*i + 1] == '/' { while *i < n && c[*i] != '\n' { *i += 1; } continue; }
            break;
        }
        if *i >= n { return None; }
        let ch = c[*i];
        if ch == '{' { *i += 1; return Some(Tok::Abre); }
        if ch == '}' { *i += 1; return Some(Tok::Cierra); }
        if ch == '"' { let mut e = *i + 1; while e < n && c[e] != '"' { e += 1; } let s: String = c[*i + 1..e.min(n)].iter().collect(); *i = e + 1; return Some(Tok::S(s, true)); }
        let mut e = *i; while e < n && !(c[e].is_whitespace() || c[e] == '{' || c[e] == '}' || c[e] == '"') { e += 1; }
        let s: String = c[*i..e].iter().collect(); *i = e; Some(Tok::S(s, false))
    };
    fn es_cond(t: &Option<Tok>) -> bool {
        match t { Some(Tok::S(s, true)) => { let b = s.as_bytes(); b.first() == Some(&b'[') && { let r = if b.get(1) == Some(&b'!') { &b[2..] } else { &b[1..] }; r.first() == Some(&b'$') && r.get(1).map(|x| x.is_ascii_alphanumeric() || *x == b'_').unwrap_or(false) } } Some(Tok::S(s, false)) => s.starts_with('[') && s.ends_with(']') && s.len() >= 2, _ => false }
    }
    fn bloque(i: &mut usize, tok: &dyn Fn(&mut usize) -> Option<Tok>) -> Vec<(String, KvVal)> {
        let mut o: Vec<(String, KvVal)> = Vec::new();
        loop {
            let k = tok(i);
            let k = match k { None | Some(Tok::Cierra) => return o, Some(Tok::Abre) => { bloque(i, tok); continue; } Some(Tok::S(s, _)) => s };
            let mut v = tok(i);
            if v.is_none() { return o; }
            if es_cond(&v) { v = tok(i); }
            let key = k.to_lowercase();
            match v {
                Some(Tok::Abre) => { let sub = bloque(i, tok); if !o.iter().any(|x| x.0 == key) { o.push((key, KvVal::T(sub))); } }
                Some(Tok::S(s, _)) => { let save = *i; let t2 = tok(i); if !es_cond(&t2) { *i = save; } if !o.iter().any(|x| x.0 == key) { o.push((key, KvVal::S(s))); } }
                _ => {}
            }
        }
    }
    let raiz = tok(&mut i);
    if !matches!(raiz, Some(Tok::S(..))) { return None; }
    if !matches!(tok(&mut i), Some(Tok::Abre)) { return None; }
    Some(bloque(&mut i, &tok))
}
/// gmaALua de un objeto de KeyValues (las claves numéricas primero, en orden, como un objeto de JavaScript)
fn kv_lua(o: &[(String, KvVal)]) -> Valor {
    let t = Tabla::nueva_ref();
    let mut idx: Vec<&(String, KvVal)> = o.iter().filter(|x| es_indice(&x.0)).collect();
    idx.sort_by_key(|x| x.0.parse::<u64>().unwrap_or(0));
    for (k, v) in idx.into_iter().chain(o.iter().filter(|x| !es_indice(&x.0))) {
        let kk = if !k.is_empty() && k.bytes().all(|c| c.is_ascii_digit()) { Valor::Num(k.parse::<f64>().unwrap_or(0.0)) } else { cad(k) };
        let vv2 = match v { KvVal::S(s) => cad(s), KvVal::T(x) => kv_lua(x) };
        let _ = t.borrow_mut().set(kk, vv2);
    }
    Valor::Tabla(t)
}
fn base64(b: &[u8]) -> String {
    const T: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut o = String::new();
    for c in b.chunks(3) {
        let n = (c[0] as u32) << 16 | (*c.get(1).unwrap_or(&0) as u32) << 8 | *c.get(2).unwrap_or(&0) as u32;
        o.push(T[(n >> 18) as usize & 63] as char);
        o.push(T[(n >> 12) as usize & 63] as char);
        o.push(if c.len() > 1 { T[(n >> 6) as usize & 63] as char } else { '=' });
        o.push(if c.len() > 2 { T[n as usize & 63] as char } else { '=' });
    }
    o
}
fn de_base64(s: &str) -> Option<Vec<u8>> {
    let mut v = Vec::new();
    let mut acc = 0u32;
    let mut nb = 0;
    for c in s.bytes() {
        let x = match c { b'A'..=b'Z' => c - b'A', b'a'..=b'z' => c - b'a' + 26, b'0'..=b'9' => c - b'0' + 52, b'+' => 62, b'/' => 63, b'=' => break, b' ' | b'\n' | b'\r' | b'\t' => continue, _ => return None } as u32;
        acc = acc << 6 | x;
        nb += 6;
        if nb >= 8 { nb -= 8; v.push((acc >> nb) as u8); }
    }
    Some(v)
}
