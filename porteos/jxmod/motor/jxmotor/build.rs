// Los sombreadores del motor Vulkan (vk.rs): los WGSL de wgsl.rs pasados a SPIR-V con naga al compilar (con la Y de la
// pantalla ajustada como lo hace wgpu: así valen las mismas cuentas). En el teléfono no se compila nada.
#[path = "src/wgsl.rs"]
#[allow(dead_code)]
mod wgsl;

fn main() {
    println!("cargo:rerun-if-changed=src/wgsl.rs");
    println!("cargo:rerun-if-changed=build.rs");
    if std::env::var("CARGO_FEATURE_VK").is_err() { return; }
    let out = std::path::PathBuf::from(std::env::var("OUT_DIR").unwrap());
    let modulos: &[(&str, &[&str])] = &[
        ("luz", &[wgsl::COMUN, wgsl::GV, wgsl::LUZ]), ("sombra", &[wgsl::COMUN, wgsl::GV, wgsl::SOMBRA]), ("cielo", &[wgsl::COMUN, wgsl::GV, wgsl::CIELO]),
        ("ao", &[wgsl::COMUN, wgsl::GV, wgsl::AO]), ("post", &[wgsl::COMUN, wgsl::POST]), ("ui", &[wgsl::UI]),
        ("agua", &[wgsl::COMUN, wgsl::GV, wgsl::AGUA]), ("part", &[wgsl::COMUN, wgsl::GV, wgsl::PART]), ("lin", &[wgsl::COMUN, wgsl::GV, wgsl::LIN]),
    ];
    for (n, partes) in modulos {
        let src = partes.concat();
        let m = naga::front::wgsl::parse_str(&src).unwrap_or_else(|e| panic!("{n}: {}", e.emit_to_string(&src)));
        let info = naga::valid::Validator::new(naga::valid::ValidationFlags::all(), naga::valid::Capabilities::all())
            .validate(&m).unwrap_or_else(|e| panic!("{n}: {e:?}"));
        let mut op = naga::back::spv::Options::default();
        op.flags.remove(naga::back::spv::WriterFlags::DEBUG);
        // (sin mapa de lugares: el grupo y el número de cada recurso de WGSL quedan como el conjunto y el lugar de Vulkan)
        op.fake_missing_bindings = true;
        let spv = naga::back::spv::write_vec(&m, &info, &op, None).unwrap_or_else(|e| panic!("{n}: {e}"));
        let b: Vec<u8> = spv.iter().flat_map(|x| x.to_le_bytes()).collect();
        std::fs::write(out.join(format!("{n}.spv")), b).unwrap();
    }
}
