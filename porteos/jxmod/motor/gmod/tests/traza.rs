//! La traza del addon de prueba (tests/addon_prueba: hooks, timers, net, cvars, HUD, un arma y una entidad) tiene que ser
//! la misma que da la capa GMod de la web con su arnés (tests/web/traza_web.js), con cada llamada a la API.
//! Para regenerar lo esperado: node tests/web/traza_web.js tests/addon_prueba --api --ticks 60 > tests/addon_prueba.esperado

#[test]
fn traza_igual_a_la_web() {
    let dir = concat!(env!("CARGO_MANIFEST_DIR"), "/tests/addon_prueba");
    let arch = jxgmod::traza::leer(dir).expect("addon de prueba");
    let (s, _, _) = jxgmod::traza::correr(vec![(dir.to_string(), arch)], 60, false, true, false);
    let esperado = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/tests/addon_prueba.esperado")).unwrap();
    if s != esperado {
        let (a, b): (Vec<&str>, Vec<&str>) = (esperado.lines().collect(), s.lines().collect());
        let i = a.iter().zip(b.iter()).position(|(x, y)| x != y).unwrap_or(a.len().min(b.len()));
        panic!("la traza difiere en la línea {}:\n  web:  {}\n  rust: {}\n(web {} líneas, rust {})", i + 1, a.get(i).unwrap_or(&"-"), b.get(i).unwrap_or(&"-"), a.len(), b.len());
    }
}

/// lo básico de la API desde Lua, sin la web: hooks, timers, entidades, la HUD
#[test]
fn api_basica() {
    use jxgmod::prueba::AnfitrionPrueba;
    let mut gm = jxgmod::Gmod::nuevo(Box::new(AnfitrionPrueba::nuevo()));
    let r = gm.correr("local n = 0 hook.Add('Think', 'x', function() n = n + 1 end) _G.cuenta = function() return n end timer.Simple(0, function() print('timer') end) return Vector(1, 2, 3):Length(), type(Angle()), IsValid(NULL)", "prueba", false).unwrap();
    assert_eq!(r.len(), 3);
    for k in 1..=3 { gm.anfitrion(|h| { let p = h.como_any().unwrap().downcast_mut::<AnfitrionPrueba>().unwrap(); p.t = k as f64 / 60.0; }); gm.paso(1.0 / 60.0, &[]); }
    let r = gm.correr("return cuenta()", "prueba2", false).unwrap();
    assert!(matches!(r[0], jxlua::Valor::Num(n) if n == 3.0));
    gm.correr("hook.Add('HUDPaint', 'h', function() surface.SetDrawColor(255, 0, 0) surface.DrawRect(1, 2, 3, 4) end)", "hud", true).unwrap();
    let r = gm.correr("local e = ents.Create('prop_physics') e:SetModel('models/props_c17/oildrum001.mdl') e:Spawn() return e:EntIndex(), e:GetModel()", "prueba3", false).unwrap();
    assert!(matches!(r[0], jxlua::Valor::Num(_)));
    gm.hud();
    let traza = gm.anfitrion(|h| h.como_any().unwrap().downcast_mut::<AnfitrionPrueba>().unwrap().traza.clone());
    assert!(traza.iter().any(|l| l.contains("crear_objeto \"Crate\"")), "{:?}", traza);
    assert!(traza.iter().any(|l| l.contains("\"rect\" 1 2 3 4 \"rgba(255,0,0,1)\"")), "{:?}", traza);
    assert!(traza.iter().any(|l| l.contains("consola \"timer\"")), "{:?}", traza);
}
