//! La física de los materiales como en Source: la tabla de surfaceproperties.txt (y _hl2) de Half-Life 2 —la fricción, la
//! elasticidad y la densidad de cada superficie, con lo que hereda de su «base» y de «default» ya resuelto—. Con ella cada
//! objeto de GMod (su $surfaceprop del .phy) resbala, rebota y flota como en Source: la madera flota, el metal se hunde, el
//! hielo y el metal resbaloso patinan, la lata y el tarro de pintura rebotan.
/// (nombre, fricción, elasticidad, densidad en kg/m³)
pub const SUPERFICIES: [(&str, f64, f64, f64); 90] = [
    ("alienflesh", 0.8, 0.25, 900.0),
    ("antlion", 0.8, 0.25, 900.0),
    ("antlionsand", 0.8, 0.01, 1600.0),
    ("armorflesh", 0.8, 0.25, 900.0),
    ("bloodyflesh", 0.8, 0.25, 900.0),
    ("boulder", 0.8, 0.2, 2400.0),
    ("brakingrubbertire", 0.6, 0.2, 1600.0),
    ("brick", 0.8, 0.2, 2400.0),
    ("canister", 0.8, 0.2, 2700.0),
    ("cardboard", 0.8, 0.01, 500.0),
    ("carpet", 0.8, 0.01, 500.0),
    ("ceiling_tile", 0.8, 0.01, 500.0),
    ("chain", 0.8, 0.25, 1600.0),
    ("chainlink", 0.8, 0.25, 1600.0),
    ("combine_glass", 0.5, 0.2, 2700.0),
    ("combine_metal", 0.8, 0.1, 2700.0),
    ("computer", 0.8, 0.1, 2700.0),
    ("concrete", 0.8, 0.2, 2400.0),
    ("concrete_block", 0.8, 0.2, 2400.0),
    ("crowbar", 0.8, 0.25, 2700.0),
    ("default", 0.8, 0.25, 2000.0),
    ("default_silent", 0.8, 0.25, 2000.0),
    ("dirt", 0.8, 0.01, 1600.0),
    ("flesh", 0.8, 0.25, 900.0),
    ("floating_metal_barrel", 0.8, 0.1, 500.0),
    ("floatingstandable", 0.8, 0.01, 800.0),
    ("foliage", 0.8, 0.1, 700.0),
    ("glass", 0.5, 0.2, 2700.0),
    ("glassbottle", 0.4, 0.3, 2700.0),
    ("grass", 0.8, 0.01, 1600.0),
    ("gravel", 0.4, 0.2, 2400.0),
    ("grenade", 0.9, 0.01, 2700.0),
    ("gunship", 0.3, 0.25, 2700.0),
    ("ice", 0.1, 0.1, 917.0),
    ("item", 0.8, 0.01, 600.0),
    ("jeeptire", 1.337, 0.2, 1600.0),
    ("ladder", 0.8, 0.25, 2700.0),
    ("metal", 0.8, 0.25, 2700.0),
    ("metal_barrel", 0.8, 0.1, 2700.0),
    ("metal_bouncy", 0.0, 1000.0, 10000.0),
    ("metal_box", 0.8, 0.1, 2700.0),
    ("metal_seafloorcar", 0.8, 0.25, 2700.0),
    ("metalgrate", 0.8, 0.25, 1600.0),
    ("metalpanel", 0.8, 0.2, 2700.0),
    ("metalvehicle", 0.8, 0.2, 2700.0),
    ("metalvent", 0.8, 0.1, 2700.0),
    ("mud", 0.6, 0.01, 1600.0),
    ("no_decal", 0.8, 0.25, 900.0),
    ("paintcan", 0.3, 0.99, 2700.0),
    ("paper", 0.8, 0.01, 500.0),
    ("papercup", 0.8, 0.1, 500.0),
    ("plaster", 0.8, 0.01, 1600.0),
    ("plastic", 0.8, 0.01, 500.0),
    ("plastic_barrel", 0.8, 0.01, 500.0),
    ("plastic_barrel_buoyant", 0.8, 0.01, 150.0),
    ("plastic_box", 0.8, 0.01, 500.0),
    ("player", 0.5, 0.001, 1000.0),
    ("player_control_clip", 0.8, 0.25, 2000.0),
    ("popcan", 0.3, 0.99, 2700.0),
    ("porcelain", 0.8, 0.2, 2400.0),
    ("pottery", 0.4, 0.3, 2700.0),
    ("quicksand", 0.8, 2.0, 600.0),
    ("rock", 0.8, 0.2, 2400.0),
    ("roller", 0.7, 0.3, 2700.0),
    ("rubber", 0.8, 0.2, 1600.0),
    ("rubbertire", 1.0, 0.2, 1600.0),
    ("sand", 0.8, 0.01, 1600.0),
    ("slidingrubbertire", 0.2, 0.2, 1600.0),
    ("slidingrubbertire_front", 0.2, 0.2, 1600.0),
    ("slidingrubbertire_rear", 0.2, 0.2, 1600.0),
    ("slime", 0.9, 0.1, 2000.0),
    ("slipperymetal", 0.1, 0.15, 2700.0),
    ("slipperyslime", 0.1, 0.01, 1600.0),
    ("snow", 0.35, 0.01, 800.0),
    ("solidmetal", 0.8, 0.1, 2700.0),
    ("strider", 0.8, 0.25, 2700.0),
    ("tile", 0.8, 0.3, 2700.0),
    ("wade", 0.8, 0.1, 1000.0),
    ("water", 0.8, 0.1, 1000.0),
    ("watermelon", 0.8, 0.25, 900.0),
    ("weapon", 0.8, 0.25, 2700.0),
    ("wood", 0.8, 0.1, 700.0),
    ("wood_box", 0.8, 0.1, 700.0),
    ("wood_crate", 0.8, 0.1, 700.0),
    ("wood_furniture", 0.8, 0.1, 700.0),
    ("wood_lowdensity", 0.8, 0.1, 300.0),
    ("wood_panel", 0.8, 0.1, 700.0),
    ("wood_plank", 0.8, 0.1, 700.0),
    ("wood_solid", 0.8, 0.1, 700.0),
    ("zombieflesh", 0.8, 0.25, 900.0),
];
/// lo de una superficie (o «default» si no está): fricción, elasticidad y densidad de Source
pub fn de(nombre: &str) -> (f64, f64, f64) {
    let n = nombre.to_ascii_lowercase();
    let f = SUPERFICIES.iter().find(|s| s.0 == n).or_else(|| SUPERFICIES.iter().find(|s| s.0 == "default")).unwrap();
    (f.1, f.2, f.3)
}
/// lo del motor de física del juego: la fricción (la de Source 0,8 es la 0,6 de acá), el rebote (la elasticidad de Source va
/// de 0 a 1 —y más, la pelota de metal—: acá, a la mitad y como mucho 0,9) y la densidad
pub fn para_fisica(nombre: &str) -> (f64, f64, f64) {
    let (f, e, d) = de(nombre);
    ((f * 0.75).clamp(0.05, 1.2), (e * 0.5).clamp(0.0, 0.9), d.clamp(100.0, 12000.0))
}

#[cfg(test)]
mod pruebas {
    use super::*;
    #[test]
    fn como_source() {
        assert_eq!(de("wood"), (0.8, 0.1, 700.0)); assert_eq!(de("metal"), (0.8, 0.25, 2700.0)); assert_eq!(de("ice").0, 0.1);
        assert_eq!(de("no_existe"), de("default"));
        let (f, r, d) = para_fisica("popcan"); assert!(r > 0.45 && f < 0.3 && d == 2700.0);
        assert!(para_fisica("wood_lowdensity").2 < 1000.0 && para_fisica("concrete").2 > 1000.0);
    }
}
