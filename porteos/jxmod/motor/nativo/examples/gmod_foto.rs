//! La prueba de los addons de GMod en el juego nativo (gmod_juego.rs): el juego de la app dibujado fuera de pantalla
//! (como foto.rs), con los addons de una carpeta montados, el panel «Mods», sus entidades puestas, sus armas en la mano
//! disparando y su HUD. Uso: gmod_foto CARPETA_SALIDA [ANCHO ALTO]
//!   JXM_ADDONS: la carpeta de addons (.gma o carpetas con lua/); JXM_WWW y JXM_LETRAS como foto.rs
//!   JXM_ARMA / JXM_ENT: la clase del arma y de la entidad a probar (si no, las primeras que traigan)
use glow::HasContext;
use jxjuego::paquete::Paquete;
use jxmod::comun::{pos_boton, Boton, Juego, Placa};
use jxmod::motor::Motor3d;
use jxmotor::gpu::{Motor, Opciones};
use khronos_egl as egl;
use std::path::Path;
use std::time::Instant;

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let sal = a.get(1).cloned().unwrap_or("/tmp/claude-0/jxm/gmod_fotos".into()); std::fs::create_dir_all(&sal).unwrap();
    let (w, h): (i32, i32) = (a.get(2).and_then(|x| x.parse().ok()).unwrap_or(1378), a.get(3).and_then(|x| x.parse().ok()).unwrap_or(634));
    let www = std::env::var("JXM_WWW").unwrap_or("/tmp/claude-0/jxp_apk/activos/www".into());
    let let_ = std::env::var("JXM_LETRAS").unwrap_or("/tmp/claude-0/jxm/letras".into());
    let motor = std::env::var("JXM_MOTOR").unwrap_or_default(); let vk = motor == "vk"; let gl2 = motor == "gl2";
    let t = Instant::now();
    let paq = Paquete::abrir(Path::new(&www));
    println!("paquete: {:.0} ms", t.elapsed().as_secs_f64() * 1000.0);
    let datos = std::env::temp_dir().join("jxm_nativo_datos"); let _ = std::fs::create_dir_all(&datos); let _ = std::fs::remove_file(datos.join("mapa.txt")); let _ = std::fs::remove_file(datos.join("ajustes.txt"));
    let letras = || (std::fs::read_to_string(Path::new(&let_).join("letras.json")).ok(), std::fs::read(Path::new(&let_).join("letras.png")).ok());
    let (lj, lp) = letras(); let mut j = Juego::nuevo(paq, lj, lp, Some(datos.clone()));
    j.gmod.carpeta_externa = std::env::var("JXM_ADDONS").ok().map(std::path::PathBuf::from);
    if let Some(f) = std::env::var("JXM_FOV").ok().and_then(|x| x.parse().ok()) { j.aj.fov = f; }
    if let Some(q) = std::env::var("JXM_CALIDAD").ok().and_then(|v| v.parse().ok()) { j.aj.poner_calidad(q); j.aj.auto = false; j.aj.dinamica = false; }   // (el campo de visión de Ajustes: la vista del arma tiene que verse igual con cualquiera)
    // (rb/: la biblioteca de GMod —gm_lib— y los datos de la versión personal —jxp—)
    j.gmod.lector_rb = Some(jxmod::comun::gmod_juego::lector_carpetas(vec![Path::new(&www).join("rb"), "/tmp/claude-0/jxp_pub/rb".into()]));
    let _ = std::fs::remove_file(datos.join("gmod_apagados.txt"));
    j.dt_fijo = Some(1.0 / 60.0);

    let (mut m, placa) = if vk {
        let m = unsafe { jxmotor::vk::Motor::nuevo(None, w as u32, h as u32, Opciones::default()) }.expect("Vulkan");
        let p = m.placa.clone(); j.en_uso = Placa::Vulkan; (Motor3d::Vk(m), p)
    } else {
        let e = unsafe { egl::DynamicInstance::<egl::EGL1_5>::load_required() }.expect("libEGL");
        let d = unsafe { e.get_platform_display(0x31DD, egl::DEFAULT_DISPLAY, &[egl::ATTRIB_NONE]) }.expect("pantalla EGL");
        e.initialize(d).unwrap(); e.bind_api(egl::OPENGL_ES_API).unwrap();
        let bit = if gl2 { egl::OPENGL_ES2_BIT } else { egl::OPENGL_ES3_BIT };
        let cfg = e.choose_first_config(d, &[egl::SURFACE_TYPE, egl::PBUFFER_BIT, egl::RENDERABLE_TYPE, bit, egl::NONE]).unwrap().or_else(|| e.choose_first_config(d, &[egl::NONE]).unwrap()).unwrap();
        let ctx = e.create_context(d, cfg, None, &[egl::CONTEXT_MAJOR_VERSION, if gl2 { 2 } else { 3 }, egl::NONE]).unwrap();
        e.make_current(d, None, None, Some(ctx)).unwrap();
        let gl = unsafe { glow::Context::from_loader_function(|s| e.get_proc_address(s).map_or(std::ptr::null(), |p| p as *const _)) };
        let placa = unsafe { gl.get_parameter_string(glow::RENDERER) };
        let fb = unsafe {
            let t = gl.create_renderbuffer().unwrap(); gl.bind_renderbuffer(glow::RENDERBUFFER, Some(t)); gl.renderbuffer_storage(glow::RENDERBUFFER, glow::RGBA8, w, h);
            let f = gl.create_framebuffer().unwrap(); gl.bind_framebuffer(glow::FRAMEBUFFER, Some(f)); gl.framebuffer_renderbuffer(glow::FRAMEBUFFER, glow::COLOR_ATTACHMENT0, glow::RENDERBUFFER, Some(t));
            // (OpenGL 2 dibuja directo en la salida: con profundidad)
            if gl2 { let p = gl.create_renderbuffer().unwrap(); gl.bind_renderbuffer(glow::RENDERBUFFER, Some(p)); gl.renderbuffer_storage(glow::RENDERBUFFER, glow::DEPTH_COMPONENT16, w, h); gl.framebuffer_renderbuffer(glow::FRAMEBUFFER, glow::DEPTH_ATTACHMENT, glow::RENDERBUFFER, Some(p)); }
            f
        };
        std::mem::forget(e);
        if gl2 { j.en_uso = Placa::Gl2; (Motor3d::Gl2(unsafe { jxmotor::gl2::Motor::nuevo(gl, jxmotor::gl2::Opciones2::default()) }.expect("motor gl2"), Some(fb)), placa) }
        else { (Motor3d::Gl(unsafe { Motor::nuevo(gl, Opciones::default()) }.expect("motor"), Some(fb)), placa) }
    };
    let (wf, hf) = (w as f32, h as f32);
    let paso = |j: &mut Juego, m: &mut Motor3d, n: usize| { for _ in 0..n { let t = Instant::now(); unsafe { j.cuadro(m, w, h, &placa).expect("cuadro"); m.esperar(); } j.medir(t.elapsed().as_secs_f32() * 1000.0); } };
    let foto = |m: &mut Motor3d, nombre: &str| {
        let dado = match m {
            Motor3d::Vk(v) => unsafe { v.leer_imagen() }.expect("imagen"),
            _ => {
                let (gl, fb): (&glow::Context, Option<glow::Framebuffer>) = match m { Motor3d::Gl(g, f) => (&g.gl, *f), Motor3d::Gl2(g, f) => (&g.gl, *f), _ => unreachable!() };
                let mut px = vec![0u8; (w * h * 4) as usize];
                unsafe { gl.bind_framebuffer(glow::FRAMEBUFFER, fb); gl.read_pixels(0, 0, w, h, glow::RGBA, glow::UNSIGNED_BYTE, glow::PixelPackData::Slice(Some(&mut px))); }
                let fila = (w * 4) as usize; let mut dado = vec![0u8; px.len()];
                for y in 0..h as usize { dado[y * fila..(y + 1) * fila].copy_from_slice(&px[(h as usize - 1 - y) * fila..(h as usize - y) * fila]); }
                dado
            }
        };
        let ruta = format!("{sal}/{nombre}.png");
        let f = std::fs::File::create(&ruta).unwrap(); let mut enc = png::Encoder::new(std::io::BufWriter::new(f), w as u32, h as u32);
        enc.set_color(png::ColorType::Rgba); enc.set_depth(png::BitDepth::Eight); enc.write_header().unwrap().write_image_data(&dado).unwrap();
        println!("  → {ruta}");
    };
    // (el mapa y los addons, uno por cuadro)
    let t = Instant::now(); paso(&mut j, &mut m, 2);
    let mut n = 0; while j.gmod.addons.iter().any(|a| a.prendido && a.idx.is_none()) && n < 200 { paso(&mut j, &mut m, 1); n += 1; }
    println!("addons montados: {} en {:.0} ms ({} cuadros)", j.gmod.addons.len(), t.elapsed().as_secs_f64() * 1000.0, n);
    for a in &j.gmod.addons { println!("  {} · armas {:?} · entidades {:?} · errores {}", a.nombre, a.sweps.iter().map(|x| &x.0).collect::<Vec<_>>(), a.sents.iter().map(|x| &x.0).collect::<Vec<_>>(), a.errores); if let (true, Some(g), Some(i)) = (a.errores > 0, j.gmod.gm.as_ref(), a.idx) { for e in g.errores(i).iter().take(4) { println!("    error: {}", e.chars().take(240).collect::<String>()); } } }
    paso(&mut j, &mut m, 30); foto(&mut m, "1_montados");
    j.gmod_abrir(); paso(&mut j, &mut m, 2); foto(&mut m, "2_panel"); j.gmod_abrir();
    // (una entidad delante)
    let ent = std::env::var("JXM_ENT").ok().or_else(|| j.gmod.addons.iter().flat_map(|a| a.sents.iter()).next().map(|x| x.0.clone()));
    if let Some(e) = &ent {
        let n0 = j.objs.len(); j.gmod_poner(&format!("gment:{}", e)); paso(&mut j, &mut m, 1);
        println!("entidad {}: objetos {} → {}", e, n0, j.objs.len());
        paso(&mut j, &mut m, 5); foto(&mut m, "3_entidad");
        if let Some(o) = j.objs.last() { println!("  objeto {} en {:?}", o.nombre, o.pos); }
        paso(&mut j, &mut m, 90); foto(&mut m, "4_entidad_1s5");
        if let Some(o) = j.objs.last() { println!("  1,5 s después: {:?}", o.pos); }
        // (JXM_USAR: mirarla y apretar Usar —la tecla E de GMod—)
        if std::env::var_os("JXM_USAR").is_some() {
            if let Some(o) = j.objs.last() { let p = o.pos; let (dx, dz) = (p[0] - j.jug.pos[0], p[2] - j.jug.pos[2]); let l = (dx * dx + dz * dz).sqrt().max(0.01); j.jug.pos[0] = p[0] - dx / l * 1.4; j.jug.pos[2] = p[2] - dz / l * 1.4; }
            if let Some(o) = j.objs.last() { let p = o.pos; let oj = [j.jug.pos[0], j.jug.pos[1] + 0.7, j.jug.pos[2]]; let d = [p[0] - oj[0], p[1] - oj[1], p[2] - oj[2]]; j.jug.yaw = d[0].atan2(d[2]); j.jug.pitch = (d[1] / (d[0] * d[0] + d[2] * d[2]).sqrt()).atan(); }
            paso(&mut j, &mut m, 3);
            let us = j.gmod.usable; println!("usable {} · mira: {}", us, j.gmod_lua_texto("local tr = LocalPlayer():GetEyeTrace() return tostring(tr.Entity) .. ' a ' .. math.Round(tr.HitPos:Distance(EyePos())) .. ' u · Use propio: ' .. tostring(IsValid(tr.Entity) and tr.Entity.Use ~= nil)"));
            let (bx, by) = pos_boton(wf, hf, Boton::Usar);
            println!("botón Usar en ({bx:.0}, {by:.0})");
            j.dedo_abajo(9, bx, by, wf, hf); paso(&mut j, &mut m, 3); j.dedo_arriba(9); paso(&mut j, &mut m, 8); foto(&mut m, "4b_usado");
            println!("vista después de usar: {}", j.gmod_lua_texto("return tostring(LocalPlayer():GetViewEntity())"));
            println!("calc: {:?} · barril en {:?}", j.gmod.calc, j.objs.last().map(|o| o.pos));
            j.jug.yaw += 1.2; paso(&mut j, &mut m, 4); foto(&mut m, "4c_usado_girando");
        }
    }
    // (JXM_HERR=<modo>: una herramienta de la Tool Gun de un addon —STOOL—: elegirla, apuntar al piso y disparar)
    if let Ok(modo) = std::env::var("JXM_HERR") {
        println!("herramientas de addons: {:?}", j.her.lista.iter().filter_map(|h| h.gm.as_ref().map(|m| format!("{m}={}", h.n))).collect::<Vec<_>>());
        if let Some(i) = j.her.lista.iter().position(|h| h.gm.as_deref() == Some(modo.as_str())) {
            j.equipar_herramienta(i); paso(&mut j, &mut m, 60);
            let antes = j.gmod_lua_texto("return tostring(#ents.GetAll())");
            j.jug.pitch = -0.6; paso(&mut j, &mut m, 3);
            let (bx, by) = pos_boton(wf, hf, Boton::Disparo);
            j.dedo_abajo(11, bx, by, wf, hf); paso(&mut j, &mut m, 2); j.dedo_arriba(11); paso(&mut j, &mut m, 15); foto(&mut m, "8b_herramienta");
            println!("herramienta {}: entidades {} → {} · {}", modo, antes, j.gmod_lua_texto("return tostring(#ents.GetAll())"), j.gmod_lua_texto("local l = {} for _, e in ipairs(ents.GetAll()) do local c = e:GetClass() if c ~= 'info_player_start' then l[#l + 1] = c end end return table.concat(l, ',')"));
            // (y el clic derecho)
            let (bx, by) = pos_boton(wf, hf, Boton::Disparo2);
            j.dedo_abajo(12, bx, by, wf, hf); paso(&mut j, &mut m, 2); j.dedo_arriba(12); paso(&mut j, &mut m, 10); foto(&mut m, "8c_herramienta_der");
            println!("después del clic derecho: vista {}", j.gmod_lua_texto("return tostring(LocalPlayer():GetViewEntity())"));
        } else { println!("no está la herramienta {}", modo); }
    }
    // (un arma en la mano, disparando)
    let arma = std::env::var("JXM_ARMA").ok().or_else(|| j.gmod.addons.iter().flat_map(|a| a.sweps.iter()).next().map(|x| x.0.clone()));
    if let Some(a) = &arma {
        j.gmod_poner(&format!("gmswep:{}", a)); paso(&mut j, &mut m, 20);
        println!("arma {}: activa {} · base {}", a, j.gmod_arma_activa(), j.armas.def().n); foto(&mut m, "5_arma");
        let (bx, by) = pos_boton(wf, hf, Boton::Disparo);
        j.dedo_abajo(7, bx, by, wf, hf); paso(&mut j, &mut m, 1); foto(&mut m, "6_disparo"); paso(&mut j, &mut m, 3); paso(&mut j, &mut m, 20); j.dedo_arriba(7);
        let (bx, by) = pos_boton(wf, hf, Boton::Disparo2);
        j.dedo_abajo(8, bx, by, wf, hf); paso(&mut j, &mut m, 4); foto(&mut m, "7_disparo2"); j.dedo_arriba(8); paso(&mut j, &mut m, 10);
        // (de afuera: el modelo de mundo en la mano)
        j.camara = 1; paso(&mut j, &mut m, 6); foto(&mut m, "7b_arma_tercera"); j.camara = 0; paso(&mut j, &mut m, 2);
        println!("vista propia {} · modelo de mundo en la mano {}", j.gmod_vista_propia(), j.gmod_arma_mundo());
        // (JXM_LUA: un pedazo de Lua para preguntar algo después de tener el arma 4 s en la mano, como la web)
        if let Ok(l) = std::env::var("JXM_LUA") { j.jug.yaw = 0.0; j.jug.pitch = 0.0; paso(&mut j, &mut m, 240); println!("lua: {}", j.gmod_lua_texto(&std::fs::read_to_string(&l).unwrap_or(l))); paso(&mut j, &mut m, 2); foto(&mut m, "7c_arma_4s");
            // (JXM_VGUI_TOCAR: tocar con el dedo lo que el Lua dejó en __p_check, __p_boton y __p_combo)
            if std::env::var_os("JXM_VGUI_TOCAR").is_some() {
                let k = j.gmod.escala_lua();
                let mut tocar = |j: &mut Juego, m: &mut Motor3d, quien: &str| {
                    let r = j.gmod_lua_texto(&format!("if not IsValid({q}) then return '' end local x, y = {q}:LocalToScreen(math.min(10, {q}:GetWide() / 2), {q}:GetTall() / 2) return x .. ',' .. y", q = quien));
                    let v: Vec<f32> = r.split(',').filter_map(|x| x.parse().ok()).collect();
                    if v.len() == 2 { j.dedo_abajo(21, v[0] * k, v[1] * k, wf, hf); paso(j, m, 2); j.dedo_arriba_en(21, wf, hf); paso(j, m, 3); }
                    println!("tocado {quien} en {r}");
                };
                tocar(&mut j, &mut m, "__p_check"); tocar(&mut j, &mut m, "__p_boton"); tocar(&mut j, &mut m, "__p_combo");
                foto(&mut m, "7d_menu_combo");
                println!("estado: {}", j.gmod_lua_texto("local o = '' for _, p in ipairs(vgui.GetAll()) do if p:GetClassName() == 'DMenuOption' and p:GetText() == 'Rojo' then _G.__p_rojo = p end end return 'check=' .. tostring(__p_check:GetChecked()) .. ' aplicado=' .. tostring(__aplicado) .. ' menu=' .. tostring(IsValid(__p_rojo) and __p_rojo:IsVisible())"));
                tocar(&mut j, &mut m, "__p_rojo");
                println!("combo después: {}", j.gmod_lua_texto("return tostring(__p_combo:GetSelected())"));
                foto(&mut m, "7e_combo_elegido");
            }
        }
    }
    // (JXM_NB: un nextbot delante; persigue al jugador)
    if let Ok(nb) = std::env::var("JXM_NB") {
        // (lejos del punto de aparición: hay nextbots que no persiguen al que está ahí)
        j.jug.pos[0] += 15.0; paso(&mut j, &mut m, 10);
        for (k, c) in nb.split(',').enumerate() {
            let n0 = j.objs.len(); j.gmod_poner(&format!("gment:{}", c)); paso(&mut j, &mut m, 20);
            println!("nextbot {}: objetos {} → {} · dibujos {} modelos, {} sprites, {} ocultos", c, n0, j.gmod.objs_gm(), j.gmod.mods.dib.modelos.len(), j.gmod.mods.dib.sprites.len(), j.gmod.mods.dib.ocultos.len());
            foto(&mut m, &format!("n{k}_nextbot"));
            let p0 = j.gmod.nb_pos(); let mut ms3 = vec![]; for _ in 0..120 { paso(&mut j, &mut m, 1); ms3.push(j.gmod.ms + j.gmod.ms_3d); } let p1 = j.gmod.nb_pos();
            ms3.sort_by(|a, b| a.partial_cmp(b).unwrap()); println!("  Lua + 3D con el nextbot: mediana {:.3} ms, p95 {:.3} ms", ms3[60], ms3[114]);
            println!("  2 s después: {:?} → {:?} (jugador en {:?})", p0, p1, j.jug.pos);
            foto(&mut m, &format!("n{k}_nextbot_2s"));
        }
    }
    println!("modelos armados {} ({} triángulos; el más lento {:.1} ms: {}) · {:?}", j.gmod.mods.armados, j.gmod.mods.tris, j.gmod.mods.ms_max.0, j.gmod.mods.ms_max.1, j.gmod.mods.modelos.iter().map(|(k, v)| (k.clone(), v.is_some())).collect::<Vec<_>>());
    // (JXM_MENU=1: el menú de GMod: pestañas, listas, poner un prop de un spawnlist, un NPC y un vehículo)
    if std::env::var("JXM_MENU").is_ok() {
        j.gmod_abrir(); paso(&mut j, &mut m, 3);
        let ls = j.gmod_menu_listas(); println!("menú: {:?}", ls.iter().map(|x| x.len()).collect::<Vec<_>>()); println!("  NPCs: {:?}", ls.get(3)); println!("  Vehicles: {:?}", ls.get(4));
        let its = j.gmod_menu_ir(0, 0); paso(&mut j, &mut m, 12); foto(&mut m, "m1_spawnlists");
        let prop = its.iter().find(|i| { let r = i.trim_start_matches("gmprop:"); j.gmod.gm.as_ref().map(|g| g.archivo(r).is_some()).unwrap_or(false) }).cloned();
        println!("  lista 0: {} cosas; con modelo en la biblioteca: {:?}", its.len(), prop);
        j.gmod_menu_ir(3, 0); paso(&mut j, &mut m, 12); foto(&mut m, "m2_npcs");
        // (los addons en Spawnlists: «Addons» y uno por addon, con sus modelos de jugador, NPC, vehículos y props)
        if let Some(i) = ls.get(0).and_then(|l| l.iter().position(|x| x == "Addons")) { let its = j.gmod_menu_ir(0, i + 1); println!("  Spawnlists › Addons › {}: {:?}", ls[0].get(i + 1).cloned().unwrap_or_default(), its); paso(&mut j, &mut m, 12); foto(&mut m, "m2b_addons"); }
        if let Some(i) = ls.get(3).and_then(|l| l.iter().position(|x| x == "Personajes de los mods")) { println!("  NPCs › Personajes de los mods: {:?}", j.gmod_menu_ir(3, i)); }
        j.gmod_menu_ir(1, 0); paso(&mut j, &mut m, 12); foto(&mut m, "m3_weapons");
        if let Some(p) = prop { let n0 = j.objs.len(); j.gmod_menu_poner(&p); paso(&mut j, &mut m, 40); println!("  puesto {}: objetos {} → {} ({:?})", p, n0, j.objs.len(), j.objs.last().map(|o| o.nombre.clone())); foto(&mut m, "m4_prop"); }
        // (los NPC de las listas: los del motor con su modelo —el soldado de élite, de la biblioteca— y los de los addons;
        // un modelo de personaje como NPC y como muñeco; los vehículos de base_vehicles y de los addons, y manejar el Jeep)
        let npcs: Vec<String> = std::env::var("JXM_NPCS").unwrap_or("gmnpc:CombineElite,gmnpc:npc_combine_s".into()).split(',').map(String::from).collect();
        for (k, it) in npcs.iter().enumerate() {
            let n0 = j.npcs.lista.len(); j.gmod_menu_poner(it); paso(&mut j, &mut m, 90);
            println!("  {}: NPC {} → {} · {:?}", it, n0, j.npcs.lista.len(), j.npcs.lista.last().map(|p| (p.skin.clone(), p.act.hostil, p.vida, j.gmp_listo(&p.skin))));
            foto(&mut m, &format!("m6_npc{k}"));
            if let Some(id) = j.npcs.lista.last().map(|p| 1 + p.id as u64) { println!("    numeros {}", j.gmp_info(id).unwrap_or_default()); }
        }
        let lista = j.gmp_lista();
        if let Some(r) = lista.first().map(|x| x.0.clone()) {
            j.gmod_menu_poner(&format!("gmnpcm:{r}")); paso(&mut j, &mut m, 60); println!("  modelo como NPC: {:?}", j.npcs.lista.last().map(|p| p.skin.clone())); foto(&mut m, "m6_npc_modelo");
            j.gmod_menu_poner(&format!("gmrag:{r}")); paso(&mut j, &mut m, 90); println!("  muñeco: {:?} tirado {}", j.npcs.lista.last().map(|p| p.skin.clone()), j.npcs.lista.last().map(|p| p.rag.is_some()).unwrap_or(false));
            if let Some(id) = j.npcs.lista.last().map(|p| 1 + p.id as u64) { println!("    numeros {}", j.gmp_info(id).unwrap_or_default()); }
            foto(&mut m, "m6_muneco");
        }
        let vehs: Vec<String> = std::env::var("JXM_VEHS").unwrap_or("gmveh:Jeep,gmveh:Airboat".into()).split(',').map(String::from).collect();
        for (k, it) in vehs.iter().enumerate() {
            j.jug.pos[0] += 8.0; paso(&mut j, &mut m, 5);
            let n0 = j.objs.len(); j.gmod_menu_poner(it); paso(&mut j, &mut m, 60);
            let o = j.objs.last().map(|o| (o.nombre.clone(), o.cuerpo, o.pos));
            let info = o.as_ref().and_then(|x| x.1).and_then(|c| j.vehs.de(c)).map(|v| format!("tipo {:?} ruedas {} asientos {} bote {}", v.tipo, v.ruedas.len(), v.asientos.len(), v.bote)).unwrap_or_default();
            println!("  {}: objetos {} → {} {:?} · {}", it, n0, j.objs.len(), o, info);
            // (el árbol del prefab, para comparar con la web: los nodos con su lugar y lo de las ruedas)
            if let Some(arb) = j.gs_arbol(it).and_then(|v| v.as_array().cloned()) {
                let r = |v: &serde_json::Value| v.as_array().map(|a| a.iter().map(|x| (x.as_f64().unwrap_or(0.0) * 1000.0).round() / 1000.0).collect::<Vec<_>>()).unwrap_or_default();
                println!("    raiz r {:?} m {} bote {}", r(&arb[0]["r"]), arb[0]["rb"]["m"], arb[0]["bote"]);
                for n in arb.iter().skip(1) { println!("    {} p {:?}{}", n["n"].as_str().unwrap_or(""), r(&n["p"]), if n["wc"].is_object() { format!(" wc r {:.4} sd {} sp {:.1} da {:.2}", n["wc"]["r"].as_f64().unwrap_or(0.0), n["wc"]["sd"], n["wc"]["sp"].as_f64().unwrap_or(0.0), n["wc"]["da"].as_f64().unwrap_or(0.0)) } else { String::new() }); }
            }
            foto(&mut m, &format!("m7_vehiculo{k}"));
            // (subir y manejar 3 s hacia adelante)
            if k == 0 { if let Some((_, Some(c), p0)) = o {
                let sube = j.vehs.subir(&j.fis, c); paso(&mut j, &mut m, 10);
                j.dedo_abajo(1, wf * 0.15, hf * 0.75, wf, hf); j.dedo_mueve(1, wf * 0.15, hf * 0.75 - hf * 0.2, hf); paso(&mut j, &mut m, 180);
                let p1 = j.objs.iter().find(|x| x.cuerpo == Some(c)).map(|x| x.pos).unwrap_or(p0); let v = j.fis.cuerpo(c).map(|b| (b.vel[0].powi(2) + b.vel[2].powi(2)).sqrt()).unwrap_or(0.0);
                println!("    manejando (subió {}): {:?} → {:?} ({:.1} m) a {:.1} m/s; ruedas tocan {:?}", sube, p0, p1, ((p1[0] - p0[0]).powi(2) + (p1[2] - p0[2]).powi(2)).sqrt(), v, j.vehs.de(c).map(|v| v.ruedas.iter().filter(|r| r.toca).count()));
                foto(&mut m, "m7b_manejando"); j.dedo_arriba(1); j.camara = 1; paso(&mut j, &mut m, 20); foto(&mut m, "m7c_manejando_afuera"); j.camara = 0;
                let _ = j.vehs.salir(&j.fis, &j.mapa.as_ref().unwrap().mundo); paso(&mut j, &mut m, 5);
            } }
        }
    }
    // (JXM_PM=1 o una ruta: ponerse un modelo de jugador de los addons —el primero de la lista— y verlo de frente quieto,
    // caminando, corriendo y saltando, de atrás y como NPC; JXM_PM_TODOS=1: uno por uno todos los de la lista, de frente)
    if let Ok(pm) = std::env::var("JXM_PM") {
        let lista = j.gmp_lista(); println!("modelos de jugador: {}", lista.len()); for x in &lista { println!("  {} · {} · {}", x.0, x.1, x.2); }
        let todos = std::env::var("JXM_PM_TODOS").is_ok();
        let elegidos: Vec<String> = if todos { lista.iter().map(|x| x.0.clone()).collect() } else if pm.ends_with(".mdl") { vec![pm.clone()] } else { lista.first().map(|x| vec![x.0.clone()]).unwrap_or_default() };
        let (cx, cy) = pos_boton(wf, hf, Boton::Camara);
        for (k, r) in elegidos.iter().enumerate() {
            j.gmp_elegir(&mut m, &format!("gmpm:{r}")); paso(&mut j, &mut m, 5);
            // (JXM_ARMA_I=n: con esa arma del juego en la mano —3: la palanca—)
            if let Some(i) = std::env::var("JXM_ARMA_I").ok().and_then(|x| x.parse::<usize>().ok()) { j.armas.elegir(&mut j.fis, i); paso(&mut j, &mut m, 20); println!("  arma: {}", j.armas.def().n); }
            println!("puesto {} · armado {}", r, j.gmp_listo(&j.skin.clone()));
            let n = r.rsplit('/').next().unwrap_or(r).trim_end_matches(".mdl").to_string();
            println!("  aparece en {:?} yaw {}", j.jug.pos, j.jug.yaw); j.jug.yaw = 0.0; j.jug.pitch = 0.0;
            // (JXM_LUGAR=x,y,z: donde está el de la web, para fotos desde el mismo lugar)
            if let Ok(l) = std::env::var("JXM_LUGAR") { let v: Vec<f32> = l.split(',').filter_map(|x| x.parse().ok()).collect(); if v.len() >= 3 { j.jug.pos = [v[0], v[1], v[2]]; j.jug.vel = [0.0; 3]; } }
            // (primero un rato en primera persona —como jugando—, después de frente)
            if std::env::var_os("JXM_PRIMERA").is_some() { j.camara = 0; paso(&mut j, &mut m, 40); foto(&mut m, &format!("p{k}_{n}_primera")); }
            j.camara = 2; paso(&mut j, &mut m, 30); foto(&mut m, &format!("p{k}_{n}_frente"));
            // (JXM_GOLPE: el golpe con el arma, de frente, cuadro por cuadro; y lo más lejos que quedó un hueso del modelo)
            if std::env::var_os("JXM_GOLPE").is_some() {
                let (bx, by) = pos_boton(wf, hf, Boton::Disparo); j.dedo_abajo(5, bx, by, wf, hf);
                for c in 0..24 { paso(&mut j, &mut m, 1); if c % 3 == 0 { foto(&mut m, &format!("p{k}_{n}_golpe{c:02}")); } println!("  golpe {c}: {}", j.gmp_info(0).unwrap_or_default().chars().take(160).collect::<String>()); }
                j.dedo_arriba(5); paso(&mut j, &mut m, 10);
            }
            println!("  numeros {}", j.gmp_info(0).unwrap_or_default());
            if todos { continue; }
            // (con JXM_ARMA: el arma en primera persona, con las manos de este modelo —AddValidHands—)
            if let Ok(a) = std::env::var("JXM_ARMA") { j.camara = 0; j.gmod_poner(&format!("gmswep:{a}")); paso(&mut j, &mut m, 120); foto(&mut m, &format!("p{k}_{n}_manos")); println!("  manos: {}", j.gmod_lua_texto("local h = player_manager.TranslatePlayerHands(player_manager.TranslateToPlayerModelName(LocalPlayer():GetModel())) return tostring(LocalPlayer():GetModel()) .. ' ' .. tostring(h.model)")); }
            j.camara = 1; paso(&mut j, &mut m, 10); foto(&mut m, &format!("p{k}_{n}_atras"));
            j.camara = 2; if let Ok(l) = std::env::var("JXM_LUGAR") { let v: Vec<f32> = l.split(',').filter_map(|x| x.parse().ok()).collect(); if v.len() >= 3 { j.jug.pos = [v[0], v[1], v[2]]; j.jug.vel = [0.0; 3]; j.jug.yaw = 0.0; } }
            j.dedo_abajo(1, wf * 0.15, hf * 0.75, wf, hf); j.dedo_mueve(1, wf * 0.15, hf * 0.75 - hf * 0.08, hf); paso(&mut j, &mut m, 40); foto(&mut m, &format!("p{k}_{n}_camina"));
            j.dedo_mueve(1, wf * 0.15, hf * 0.75 - hf * 0.3, hf); paso(&mut j, &mut m, 40); foto(&mut m, &format!("p{k}_{n}_corre")); j.dedo_arriba(1); paso(&mut j, &mut m, 30);
            let (bx, by) = pos_boton(wf, hf, Boton::Saltar); j.dedo_abajo(2, bx, by, wf, hf); paso(&mut j, &mut m, 8); j.dedo_arriba(2); paso(&mut j, &mut m, 6); foto(&mut m, &format!("p{k}_{n}_salta")); paso(&mut j, &mut m, 60);
            let _ = (cx, cy);
        }
        j.camara = 0; paso(&mut j, &mut m, 2);
    }
    // (JXM_PILL=id[,id…]: transformarse —freddy, goku, gm:<nombre> de un Pill Pack—, con un NPC delante: quieto, el golpe,
    // la habilidad 2, correr y volver)
    if let Ok(ids) = std::env::var("JXM_PILL") {
        j.gmod_abrir(); paso(&mut j, &mut m, 3); println!("Pill Packs: {:?}", j.gmod_menu_listas().get(5)); j.gmod_abrir();
        for (k, id) in ids.split(',').enumerate() {
            let _ = j.gmod_prueba_poner(&mut m, "npc:Hero"); paso(&mut j, &mut m, 30);
            let v0 = j.npcs.lista.last().map(|p| p.vida).unwrap_or(0.0);
            j.gmod_menu_poner(&format!("pill:{id}")); paso(&mut j, &mut m, 30);
            println!("pill {}: puesto {} · skin {} · vida {} · vel {} · salto {} · cámara {}", id, j.pill_on(), j.skin, j.jug.vida, j.jug.vel_max, j.jug.salto, j.camara);
            foto(&mut m, &format!("q{k}_pill"));
            let (bx, by) = pos_boton(wf, hf, Boton::Disparo); j.dedo_abajo(9, bx, by, wf, hf); paso(&mut j, &mut m, 3); j.dedo_arriba(9); paso(&mut j, &mut m, 2); foto(&mut m, &format!("q{k}_pill_golpe")); paso(&mut j, &mut m, 30);
            println!("  golpe: vida del NPC {} → {:?} (tirado {:?})", v0, j.npcs.lista.last().map(|p| p.vida), j.npcs.lista.last().map(|p| p.rag.is_some()));
            let (bx, by) = pos_boton(wf, hf, Boton::Disparo2); j.dedo_abajo(9, bx, by, wf, hf); paso(&mut j, &mut m, 3); j.dedo_arriba(9); paso(&mut j, &mut m, 20); foto(&mut m, &format!("q{k}_pill_hab2"));
            j.gmod_menu_poner("pillfin:"); paso(&mut j, &mut m, 20); println!("  volvió: {} · skin {} · vel {} · cámara {}", !j.pill_on(), j.skin, j.jug.vel_max, j.camara);
        }
    }
    // (JXM_TIENDA=1: la tienda de verdad con curl: la lista, bajar el más chico, descomprimir e instalar)
    if std::env::var("JXM_TIENDA").is_ok() {
        j.gmod.http_bin = Some(std::sync::Arc::new(|u: &str| {
            let o = std::process::Command::new("curl").args(["-s", "-w", "\n%{http_code}", u]).output().map_err(|e| e.to_string())?;
            let mut b = o.stdout; let i = b.iter().rposition(|c| *c == b'\n').unwrap_or(0); let cod: u16 = String::from_utf8_lossy(&b[i + 1..]).trim().parse().unwrap_or(0); b.truncate(i); Ok((cod, b))
        }));
        j.gmod_tienda_pedir();
        let mut n = 0; while j.gmod.tienda.is_empty() && n < 600 { paso(&mut j, &mut m, 1); n += 1; }
        println!("tienda: {} con archivo directo", j.gmod.tienda.len());
        j.gmod_abrir(); paso(&mut j, &mut m, 2); foto(&mut m, "9_tienda"); j.gmod_abrir();
        if let Some(k) = (0..j.gmod.tienda.len()).min_by(|a, b| j.gmod.tienda[*a].mb.partial_cmp(&j.gmod.tienda[*b].mb).unwrap()) {
            println!("bajando {}", j.gmod.tienda[k].titulo); let t = Instant::now(); let antes = j.gmod.addons.len();
            j.gmod_bajar(k);
            let mut n = 0; while j.gmod.tienda[k].estado == "Bajando…" && n < 3000 { paso(&mut j, &mut m, 1); n += 1; }
            let mut n2 = 0; while j.gmod.addons.iter().any(|a| a.prendido && a.idx.is_none()) && n2 < 100 { paso(&mut j, &mut m, 1); n2 += 1; }
            println!("  → {} en {:.1} s; addons {} → {}", j.gmod.tienda[k].estado, t.elapsed().as_secs_f32(), antes, j.gmod.addons.len());
            if let Some(a) = j.gmod.addons.last() { println!("  {} · armas {:?} · entidades {:?}", a.nombre, a.sweps, a.sents); }
        }
    }
    // (lo que tarda el Lua por cuadro, con todo montado)
    let mut ms = vec![]; for _ in 0..120 { paso(&mut j, &mut m, 1); ms.push(j.gmod.ms); }
    ms.sort_by(|a, b| a.partial_cmp(b).unwrap());
    println!("Lua por cuadro: mediana {:.3} ms, p95 {:.3} ms, máx {:.3} ms · cuadro entero {:.1} ms", ms[60], ms[114], ms[119], j.ms);
    { let mut g3 = vec![]; for _ in 0..60 { let t = Instant::now(); paso(&mut j, &mut m, 1); let _ = t; g3.push(j.gmod.ms_3d); } g3.sort_by(|a, b| a.partial_cmp(b).unwrap()); println!("dibujo 3D del Lua + modelos por cuadro: mediana {:.3} ms, p95 {:.3} ms", g3[30], g3[57]); }
    foto(&mut m, "8_final");
    println!("pedidos del Lua: {:?}", j.gmod.cuenta);
}
