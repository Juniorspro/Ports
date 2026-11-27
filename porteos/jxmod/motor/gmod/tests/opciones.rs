//! Las opciones de los addons (spawnmenu.AddToolMenuOption): un addon como los de deslizarse o el cuerpo en primera persona
//! registra su panel en PopulateToolMenu; el juego lo lee como controles (con los valores de las ConVars) y los toca.
use jxgmod::prueba::AnfitrionPrueba;
use jxgmod::Control;

#[test]
fn opciones_de_los_addons() {
    let mut gm = jxgmod::Gmod::nuevo(Box::new(AnfitrionPrueba::nuevo()));
    let lua = r#"
        CreateClientConVar("slide_enabled", "1", true, false)
        CreateClientConVar("slide_speed", "300", true, false)
        CreateClientConVar("legs_mode", "a", true, false)
        hook.Add("PopulateToolMenu", "slide_menu", function()
            spawnmenu.AddToolMenuOption("Options", "Sliding", "slide_opts", "Sliding Ability", "", "", function(panel)
                panel:ClearControls()
                panel:Help("Slide by crouching while sprinting.")
                panel:CheckBox("Enable sliding", "slide_enabled")
                panel:NumSlider("Slide speed", "slide_speed", 100, 600, 0)
                local cb = panel:ComboBox("Legs", "legs_mode") cb:AddChoice("Modo A", "a") cb:AddChoice("Modo B", "b")
                panel:AddControl("CheckBox", { Label = "Old style checkbox", Command = "slide_old" })
                panel:Button("Reset", "slide_reset")
            end)
        end)
        concommand.Add("slide_reset", function() RunConsoleCommand("slide_speed", "250") end)
        CreateClientConVar("slide_old", "0", true, false)
    "#;
    gm.correr(lua, "lua/autorun/client/slide.lua", true).unwrap();
    // (en el juego lo corre el montaje de cada addon; acá, a mano)
    gm.correr("hook.Run('PopulateToolMenu')", "pop", true).unwrap();
    let ops = gm.opciones_menu();
    assert_eq!(ops.len(), 1, "{ops:?}"); assert_eq!(ops[0].2, "Sliding Ability"); assert_eq!(ops[0].1, "Sliding");
    let c = gm.opcion_armar(0);
    println!("{c:#?}");
    assert!(matches!(&c[0], Control::Ayuda(t) if t.contains("crouching")));
    assert_eq!(c[1], Control::Check { txt: "Enable sliding".into(), on: true });
    assert!(matches!(&c[2], Control::Slider { txt, v, min, max, .. } if txt == "Slide speed" && *v == 300.0 && *min == 100.0 && *max == 600.0));
    assert!(matches!(&c[3], Control::Combo { txt, ops, .. } if txt == "Legs" && ops.len() == 2));
    assert_eq!(c[4], Control::Check { txt: "Old style checkbox".into(), on: false });
    assert_eq!(c[5], Control::Boton("Reset".into()));
    // (tocar: la casilla se apaga y la ConVar con ella; el deslizador; el combo; la casilla vieja; el botón corre su comando)
    gm.opcion_tocar(0, 1, jxlua::Valor::Nil); assert_eq!(gm.cvar_leer("slide_enabled").as_deref(), Some("0"));
    gm.opcion_tocar(0, 2, jxlua::Valor::Num(450.0)); assert_eq!(gm.cvar_leer("slide_speed").as_deref(), Some("450"));
    gm.opcion_tocar(0, 3, jxlua::Valor::Num(2.0)); assert_eq!(gm.cvar_leer("legs_mode").as_deref(), Some("b"));
    gm.opcion_tocar(0, 4, jxlua::Valor::Nil); assert_eq!(gm.cvar_leer("slide_old").as_deref(), Some("1"));
    let c2 = gm.opcion_leer(0);
    assert_eq!(c2[1], Control::Check { txt: "Enable sliding".into(), on: false });
    assert!(matches!(&c2[3], Control::Combo { sel: 2, .. }), "{:?}", c2[3]);
    gm.opcion_tocar(0, 5, jxlua::Valor::Nil); assert_eq!(gm.cvar_leer("slide_speed").as_deref(), Some("250"));
    // (otra vez la casilla: se prende)
    gm.opcion_tocar(0, 1, jxlua::Valor::Nil); assert_eq!(gm.cvar_leer("slide_enabled").as_deref(), Some("1"));
    // (los paneles de las opciones están escondidos: no se dibujan arriba del juego)
    let r = gm.correr("return IsValid(__JXM_OPC[1]) and __JXM_OPC[1]:IsVisible()", "vis", true).unwrap();
    assert!(matches!(r[0], jxlua::Valor::Bool(false)), "{:?}", r);
}
