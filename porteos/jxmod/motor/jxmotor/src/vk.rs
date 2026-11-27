//! JX Motor sobre Vulkan directo (ash), sin wgpu: el control entero de la placa. Dibuja lo mismo que gpu.rs (OpenGL 3) y
//! wg.rs con los mismos sombreadores WGSL, pasados a SPIR-V al compilar (build.rs). Lo propio de Vulkan:
//!  - pasadas con lo que se carga y se guarda de cada imagen dicho a mano (en las placas de los teléfonos, que dibujan por
//!    mosaicos, lo que no se guarda no sale de la placa): la profundidad de la escena sólo se guarda si alguien la lee;
//!  - la imagen final girada por el juego cuando la pantalla está de costado (preTransform): el sistema no tiene que girarla;
//!  - dos cuadros en vuelo, con lo que cambia en cada cuadro (cabeceras, registros, matrices, huesos, HUD) en búferes
//!    propios de cada uno; la placa nunca espera a la CPU ni al revés;
//!  - marcas de tiempo de la placa por pasada (cuánto tarda de verdad cada una);
//!  - sin ventana (la compu, lavapipe): la imagen final en una imagen propia que se puede leer.
//! Las pasadas: sombra (dos cascadas), el reflejo del agua, la escena (lo opaco con instancias y el cielo), oclusión, lo
//! transparente, el agua de HL2 (con la escena copiada para la refracción), la imagen final y el HUD. Las marcas (frenadas,
//! quemaduras, agujeros de bala) van después de la oclusión y antes de lo transparente, con su sesgo de profundidad; las
//! partículas, al final de la última pasada de la escena (después del agua), mirando la profundidad sin escribirla: como gpu.rs.
use crate::escena::{Agua, Cielo, Cuadro, Escena, ItemDin, Mat, FL_CIELO, FL_SIN_SOMBRA, EF_MARCAS, EF_PART_ALFA, EF_PART_SUMA};
use crate::gpu::{Opciones, MAX_HUESOS, MAX_LUCES};
use crate::mat::{self, M4};
use ash::vk;
use std::collections::HashMap;
use std::ffi::{c_void, CStr, CString};

const SPV_LUZ: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/luz.spv"));
const SPV_SOMBRA: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/sombra.spv"));
const SPV_CIELO: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/cielo.spv"));
const SPV_AO: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/ao.spv"));
const SPV_POST: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/post.spv"));
const SPV_UI: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/ui.spv"));
const SPV_AGUA: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/agua.spv"));
const SPV_PART: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/part.spv"));
const SPV_LIN: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/lin.spv"));

/// los registros (de a 256 bytes: el desplazamiento dinámico)
const G_PASO: u64 = 1280;
const G_TAM: u64 = 1136;
const O_PASO: u64 = 256;
const O_TAM: u64 = 176;
const H_PASO: u64 = 2816;
const H_TAM: u64 = 2688;
const U_PASO: u64 = 256;
const U_TAM: u64 = 32;
/// cabeceras: 0 la cámara, 1 (el reflejo, todavía no), 2 y 3 las cascadas de la sombra
const G_SOM: u64 = 2;
const G_REF: u64 = 1;
const MARCOS: usize = 2;
const FMT: vk::Format = vk::Format::R8G8B8A8_UNORM;
const NTIEMPOS: u32 = 16;
/// el sesgo de profundidad de una tubería (constante, por la pendiente): ninguno, el de la sombra (hacia atrás) y el de las
/// marcas (hacia la cámara: glPolygonOffset(-2, -4) de gpu.rs)
const SESGO_NO: (f32, f32) = (0.0, 0.0);
const SESGO_SOMBRA: (f32, f32) = (3.0, 1.5);
const SESGO_MARCAS: (f32, f32) = (-4.0, -2.0);
/// los números de cada partícula (la fila de efectos.js) y de cada vértice de las marcas
const PART_F: usize = 16;
const MARCA_F: usize = 7;

type ClaveMat = [i64; 5];
#[derive(Clone)]
struct Dib { m: i64, s0: u32, sn: u32, obj: u32, inst: u64, n: u32, hue: Option<u32>, mk: ClaveMat, mezcla: u8, piel: bool, corte: bool, lejos: f32 }
#[derive(Default)]
struct Arm { obj: Vec<f32>, porobj: HashMap<(i64, i64, u8), u32>, inst: Vec<f32>, hue: Vec<f32>, porhue: HashMap<u64, u32>, claves: Vec<ClaveMat> }

/// un búfer con su memoria (los de cada cuadro quedan mapeados)
struct Bufv { b: vk::Buffer, m: vk::DeviceMemory, tam: u64, ptr: *mut u8 }
/// una imagen con su memoria y su vista
struct Img { i: vk::Image, m: vk::DeviceMemory, v: vk::ImageView, w: u32, h: u32, bytes: usize }
struct MallaV { vb: Bufv, ib: Bufv, lm: Option<Bufv>, piel: Option<Bufv>, i32: bool, mn: [f32; 3], sc: [f32; 3], lm_id: i64, bytes: usize }

/// lo de cada cuadro en vuelo
struct Marco {
    cb: vk::CommandBuffer, listo: vk::Fence, sem_img: vk::Semaphore, pool: vk::DescriptorPool,
    glob: Bufv, obj: Bufv, hue: Bufv, inst: Bufv, post: Bufv, ui: Bufv, uiu: Bufv,
    /// las partículas (una fila por instancia), la derecha y el arriba de cada bloque, y las marcas con su versión (se copian
    /// sólo cuando cambian)
    part: Bufv, partu: Bufv, marcas: Bufv, marcas_ver: u64,
    q: Option<vk::QueryPool>, nombres: Vec<&'static str>, usado: bool,
    /// las pruebas de oclusión de este cuadro (una caja por cosa) y la clave de cada una, para leerlas cuando vuelva
    oq: vk::QueryPool, oq_claves: Vec<u64>,
}
/// cuántas cajas se prueban por cuadro como mucho
const OCLU_MAX: u32 = 1024;

/// la salida: la pantalla (cadena de imágenes) o, sin ventana, una imagen propia que se puede leer
struct Cadena { sc: vk::SwapchainKHR, imgs: Vec<vk::Image>, vistas: Vec<vk::ImageView>, fbs: Vec<vk::Framebuffer>, sems: Vec<vk::Semaphore>, fmt: vk::Format, ext: vk::Extent2D, giro: u32 }
struct Propia { img: Img, fb: vk::Framebuffer, leer: Bufv }

struct Capas { glob: vk::DescriptorSetLayout, glob_solo: vk::DescriptorSetLayout, obj: vk::DescriptorSetLayout, mat: vk::DescriptorSetLayout, hue: vk::DescriptorSetLayout, cielo: vk::DescriptorSetLayout, ao: vk::DescriptorSetLayout, tex1: vk::DescriptorSetLayout, vacia: vk::DescriptorSetLayout, agua: vk::DescriptorSetLayout }
struct Planos { luz: vk::PipelineLayout, luz_piel: vk::PipelineLayout, sombra: vk::PipelineLayout, sombra_piel: vk::PipelineLayout, cielo: vk::PipelineLayout, ao: vk::PipelineLayout, tex1: vk::PipelineLayout, agua: vk::PipelineLayout, part: vk::PipelineLayout, lin: vk::PipelineLayout }
struct Pasadas { sombra: vk::RenderPass, sombra_parcial: vk::RenderPass, esc_ao: vk::RenderPass, esc: vk::RenderPass, ao: vk::RenderPass, transp: vk::RenderPass, fin: vk::RenderPass, fin_propia: vk::RenderPass, refl: vk::RenderPass }
/// (part: de alfa y las que suman)
struct Tubos { luz: [vk::Pipeline; 3], luz_piel: [vk::Pipeline; 3], luz_op: [vk::Pipeline; 2], pre: [vk::Pipeline; 2], caja: vk::Pipeline, sombra: vk::Pipeline, sombra_piel: vk::Pipeline, cielo: vk::Pipeline, ao: vk::Pipeline, ao_poner: vk::Pipeline, fin: vk::Pipeline, ui: vk::Pipeline, agua: vk::Pipeline, part: [vk::Pipeline; 2], marcas: vk::Pipeline, fmt_fin: vk::Format }
/// los destinos de las pasadas (se rehacen si cambia el tamaño)
struct Destinos { w: u32, h: u32, color: Img, prof: Img, fb_esc: vk::Framebuffer, ao: Option<(Img, vk::Framebuffer)>,
    /// con agua: la copia de la escena (para ver a través) y el reflejo (color, profundidad, su destino)
    refr: Option<Img>, refl: Option<(Img, Img, vk::Framebuffer)> }

pub struct Motor {
    _entry: ash::Entry,
    inst: ash::Instance,
    pub dev: ash::Device,
    pd: vk::PhysicalDevice,
    q: vk::Queue, _qf: u32,
    mem_props: vk::PhysicalDeviceMemoryProperties,
    sup_i: Option<ash::khr::surface::Instance>, sup: vk::SurfaceKHR,
    sc_d: Option<ash::khr::swapchain::Device>,
    cadena: Option<Cadena>, propia: Option<Propia>, rehacer: bool,
    pub op: Opciones,
    cmd_pool: vk::CommandPool,
    marcos: Vec<Marco>, marco: usize,
    capas: Capas, planos: Planos, pasadas: Pasadas, tubos: Tubos,
    mods: Vec<vk::ShaderModule>,
    s_rep: vk::Sampler, s_cla: vk::Sampler, s_cmp: vk::Sampler,
    fmt_p: vk::Format, fmt_s: vk::Format,
    blanca: Img, cubo0: Img, prof0: Img,
    mallas: HashMap<i64, MallaV>, mats: HashMap<i64, Mat>, texs: HashMap<i64, Img>, lms: HashMap<i64, Img>,
    cielo: Option<Cielo>, cubo: Option<Img>,
    agua: Option<Agua>, agua_n: Option<Img>, agua_p: Option<Img>, aguas: Vec<usize>,
    pool_mat: vk::DescriptorPool, g_mat: HashMap<ClaveMat, vk::DescriptorSet>,
    sombra: Option<(Img, vk::Framebuffer, i32)>,
    dest: Option<Destinos>,
    svp: M4, sesgo: [f32; 2], svp2: M4, sesgo2: [f32; 2], refl_piso: Option<f32>,
    /// (la huella de lo que dibujó cada cascada —su matriz y lo que tiene adentro—: si no cambió, la sombra guardada sirve)
    sombra_huella: [u64; 2],
    /// la oclusión: por cosa (su clave) si la última prueba la vio y en qué cuadro se probó; la caja (8 vértices, 36 índices)
    oclu: HashMap<u64, (bool, u64)>, caja: Option<(Bufv, Bufv)>,
    pub c: Option<Cuadro>,
    items: Vec<ItemDin>,
    opacos: Vec<usize>, transp: Vec<usize>,
    /// las marcas (llegan sólo cuando cambian: quedan acá y se copian a cada cuadro en vuelo) y su versión
    marcas: Vec<f32>, marcas_ver: u64,
    pub cuadro: u64, pub dibujos: u32, pub memoria: usize,
    pub mapa: String,
    /// la placa (nombre y versión de Vulkan)
    pub placa: String,
    periodo: f32, tiempos: Vec<(&'static str, f32)>,
}

fn palabras(b: &[u8]) -> Vec<u32> { b.chunks_exact(4).map(|c| u32::from_le_bytes([c[0], c[1], c[2], c[3]])).collect() }
fn f32b(v: &[f32]) -> &[u8] { unsafe { std::slice::from_raw_parts(v.as_ptr() as *const u8, v.len() * 4) } }
fn ve<T>(r: Result<T, vk::Result>, que: &str) -> Result<T, String> { r.map_err(|e| format!("{que}: {e:?}")) }

impl Motor {
    /// abre la placa: con `ventana` (un ANativeWindow de Android) dibuja en la pantalla; sin ventana, en una imagen propia
    /// de `w` × `h` (las pruebas en la compu)
    pub unsafe fn nuevo(ventana: Option<*mut c_void>, w: u32, h: u32, op: Opciones) -> Result<Motor, String> {
        let entry = ash::Entry::load().map_err(|e| format!("sin Vulkan: {e}"))?;
        let app = CString::new("JXMod").unwrap();
        let ai = vk::ApplicationInfo::default().application_name(&app).engine_name(&app).api_version(vk::API_VERSION_1_0);
        let mut ext: Vec<*const std::ffi::c_char> = vec![];
        if ventana.is_some() { ext.push(ash::khr::surface::NAME.as_ptr()); ext.push(ash::khr::android_surface::NAME.as_ptr()); }
        let inst = ve(entry.create_instance(&vk::InstanceCreateInfo::default().application_info(&ai).enabled_extension_names(&ext), None), "vkCreateInstance")?;
        // (la superficie de la ventana)
        let (sup_i, sup) = match ventana {
            Some(win) => {
                let ai2 = ash::khr::android_surface::Instance::new(&entry, &inst);
                let s = ve(ai2.create_android_surface(&vk::AndroidSurfaceCreateInfoKHR::default().window(win as *mut _), None), "superficie")?;
                (Some(ash::khr::surface::Instance::new(&entry, &inst)), s)
            }
            None => (None, vk::SurfaceKHR::null()),
        };
        // (la placa: la primera con una cola de dibujo que pueda mostrar en la superficie)
        let mut elegida = None;
        for pd in ve(inst.enumerate_physical_devices(), "placas")? {
            for (i, f) in inst.get_physical_device_queue_family_properties(pd).iter().enumerate() {
                if !f.queue_flags.contains(vk::QueueFlags::GRAPHICS) { continue; }
                if let Some(si) = &sup_i { if !si.get_physical_device_surface_support(pd, i as u32, sup).unwrap_or(false) { continue; } }
                elegida = Some((pd, i as u32, f.timestamp_valid_bits)); break;
            }
            if elegida.is_some() { break; }
        }
        let (pd, qf, ts_bits) = elegida.ok_or("ninguna placa con Vulkan que dibuje")?;
        let props = inst.get_physical_device_properties(pd);
        let nombre = props.device_name_as_c_str().map(|c| c.to_string_lossy().into_owned()).unwrap_or_default();
        let placa = format!("{nombre} (Vulkan {}.{}.{})", vk::api_version_major(props.api_version), vk::api_version_minor(props.api_version), vk::api_version_patch(props.api_version));
        let prio = [1.0f32];
        let qi = [vk::DeviceQueueCreateInfo::default().queue_family_index(qf).queue_priorities(&prio)];
        let dext: Vec<*const std::ffi::c_char> = if ventana.is_some() { vec![ash::khr::swapchain::NAME.as_ptr()] } else { vec![] };
        let dev = ve(inst.create_device(pd, &vk::DeviceCreateInfo::default().queue_create_infos(&qi).enabled_extension_names(&dext), None), "vkCreateDevice")?;
        let q = dev.get_device_queue(qf, 0);
        let mem_props = inst.get_physical_device_memory_properties(pd);
        // (los formatos de profundidad: la de la escena se lee —la oclusión—; la de la sombra se lee con filtro y comparación)
        let sirve = |f: vk::Format, filtro: bool| { let p = inst.get_physical_device_format_properties(pd, f).optimal_tiling_features;
            p.contains(vk::FormatFeatureFlags::DEPTH_STENCIL_ATTACHMENT | vk::FormatFeatureFlags::SAMPLED_IMAGE) && (!filtro || p.contains(vk::FormatFeatureFlags::SAMPLED_IMAGE_FILTER_LINEAR)) };
        // (24 bits primero, como GL3: alcanza y en llvmpipe/lavapipe la profundidad de 32 bits en coma flotante es mucho más lenta)
        let orden = if std::env::var_os("JXM_VK_D32").is_some() { [vk::Format::D32_SFLOAT, vk::Format::X8_D24_UNORM_PACK32, vk::Format::D16_UNORM] } else { [vk::Format::X8_D24_UNORM_PACK32, vk::Format::D32_SFLOAT, vk::Format::D16_UNORM] };
        let fmt_p = orden.into_iter().find(|&f| sirve(f, false)).ok_or("sin formato de profundidad")?;
        let fmt_s = orden.into_iter().find(|&f| sirve(f, true)).unwrap_or(fmt_p);
        let cmd_pool = ve(dev.create_command_pool(&vk::CommandPoolCreateInfo::default().queue_family_index(qf).flags(vk::CommandPoolCreateFlags::RESET_COMMAND_BUFFER), None), "pool")?;

        // --- las capas de los grupos (como en wg.rs: grupo 0 la cabecera, 1 el registro, 2 el material, 3 los huesos)
        let lay = |b: &[(u32, vk::DescriptorType, vk::ShaderStageFlags)]| -> Result<vk::DescriptorSetLayout, String> {
            let e: Vec<_> = b.iter().map(|&(n, t, s)| vk::DescriptorSetLayoutBinding::default().binding(n).descriptor_type(t).descriptor_count(1).stage_flags(s)).collect();
            ve(dev.create_descriptor_set_layout(&vk::DescriptorSetLayoutCreateInfo::default().bindings(&e), None), "capa")
        };
        use vk::DescriptorType as DT; use vk::ShaderStageFlags as SS;
        let (vf, fs) = (SS::VERTEX | SS::FRAGMENT, SS::FRAGMENT);
        let capas = Capas {
            glob: lay(&[(0, DT::UNIFORM_BUFFER_DYNAMIC, vf), (1, DT::SAMPLED_IMAGE, fs), (2, DT::SAMPLER, fs), (3, DT::SAMPLED_IMAGE, fs)])?,
            glob_solo: lay(&[(0, DT::UNIFORM_BUFFER_DYNAMIC, vf)])?,
            obj: lay(&[(0, DT::UNIFORM_BUFFER_DYNAMIC, vf)])?,
            mat: lay(&[(0, DT::SAMPLED_IMAGE, fs), (1, DT::SAMPLED_IMAGE, fs), (2, DT::SAMPLED_IMAGE, fs), (3, DT::SAMPLED_IMAGE, fs), (4, DT::SAMPLED_IMAGE, fs), (5, DT::SAMPLER, fs), (6, DT::SAMPLER, fs)])?,
            hue: lay(&[(0, DT::UNIFORM_BUFFER_DYNAMIC, SS::VERTEX)])?,
            cielo: lay(&[(0, DT::SAMPLED_IMAGE, fs), (1, DT::SAMPLER, fs)])?,
            ao: lay(&[(0, DT::SAMPLED_IMAGE, fs)])?,
            tex1: lay(&[(0, DT::SAMPLED_IMAGE, fs), (1, DT::SAMPLER, fs), (2, DT::UNIFORM_BUFFER_DYNAMIC, vf)])?,
            vacia: lay(&[])?,
            agua: lay(&[(0, DT::SAMPLED_IMAGE, fs), (1, DT::SAMPLED_IMAGE, fs), (2, DT::SAMPLED_IMAGE, fs), (3, DT::SAMPLED_IMAGE, fs), (4, DT::SAMPLED_IMAGE, fs), (5, DT::SAMPLER, fs), (6, DT::SAMPLER, fs)])?,
        };
        let pl = |c: &[vk::DescriptorSetLayout]| ve(dev.create_pipeline_layout(&vk::PipelineLayoutCreateInfo::default().set_layouts(c), None), "plano");
        let planos = Planos {
            luz: pl(&[capas.glob, capas.obj, capas.mat])?, luz_piel: pl(&[capas.glob, capas.obj, capas.mat, capas.hue])?,
            sombra: pl(&[capas.glob_solo, capas.obj])?, sombra_piel: pl(&[capas.glob_solo, capas.obj, capas.vacia, capas.hue])?,
            cielo: pl(&[capas.glob_solo, capas.cielo])?, ao: pl(&[capas.glob_solo, capas.ao])?, tex1: pl(&[capas.tex1])?, agua: pl(&[capas.glob, capas.obj, capas.agua])?,
            part: pl(&[capas.glob_solo, capas.tex1])?, lin: pl(&[capas.glob_solo])?,
        };

        // --- la salida: la cadena de la pantalla o la imagen propia (su formato decide las pasadas finales)
        let sc_d = if ventana.is_some() { Some(ash::khr::swapchain::Device::new(&inst, &dev)) } else { None };
        let fmt_fin = match &sup_i {
            Some(si) => {
                let fs = ve(si.get_physical_device_surface_formats(pd, sup), "formatos")?;
                fs.iter().map(|f| f.format).find(|&f| f == vk::Format::R8G8B8A8_UNORM || f == vk::Format::B8G8R8A8_UNORM).unwrap_or(fs[0].format)
            }
            None => FMT,
        };
        let pasadas = Pasadas {
            sombra: pasada(&dev, None, Some((fmt_s, vk::AttachmentLoadOp::CLEAR, vk::AttachmentStoreOp::STORE, vk::ImageLayout::UNDEFINED, vk::ImageLayout::DEPTH_STENCIL_READ_ONLY_OPTIMAL, false)))?,
            // (una sola cascada: se borra y dibuja sólo su mitad —el área de la pasada— y la otra queda como estaba)
            sombra_parcial: pasada(&dev, None, Some((fmt_s, vk::AttachmentLoadOp::CLEAR, vk::AttachmentStoreOp::STORE, vk::ImageLayout::DEPTH_STENCIL_READ_ONLY_OPTIMAL, vk::ImageLayout::DEPTH_STENCIL_READ_ONLY_OPTIMAL, false)))?,
            esc_ao: pasada(&dev, Some((FMT, vk::AttachmentLoadOp::CLEAR, vk::AttachmentStoreOp::STORE, vk::ImageLayout::UNDEFINED, vk::ImageLayout::COLOR_ATTACHMENT_OPTIMAL)),
                Some((fmt_p, vk::AttachmentLoadOp::CLEAR, vk::AttachmentStoreOp::STORE, vk::ImageLayout::UNDEFINED, vk::ImageLayout::DEPTH_STENCIL_READ_ONLY_OPTIMAL, false)))?,
            esc: pasada(&dev, Some((FMT, vk::AttachmentLoadOp::CLEAR, vk::AttachmentStoreOp::STORE, vk::ImageLayout::UNDEFINED, vk::ImageLayout::SHADER_READ_ONLY_OPTIMAL)),
                Some((fmt_p, vk::AttachmentLoadOp::CLEAR, vk::AttachmentStoreOp::DONT_CARE, vk::ImageLayout::UNDEFINED, vk::ImageLayout::DEPTH_STENCIL_ATTACHMENT_OPTIMAL, false)))?,
            ao: pasada(&dev, Some((FMT, vk::AttachmentLoadOp::DONT_CARE, vk::AttachmentStoreOp::STORE, vk::ImageLayout::UNDEFINED, vk::ImageLayout::SHADER_READ_ONLY_OPTIMAL)), None)?,
            transp: pasada(&dev, Some((FMT, vk::AttachmentLoadOp::LOAD, vk::AttachmentStoreOp::STORE, vk::ImageLayout::COLOR_ATTACHMENT_OPTIMAL, vk::ImageLayout::SHADER_READ_ONLY_OPTIMAL)),
                Some((fmt_p, vk::AttachmentLoadOp::LOAD, vk::AttachmentStoreOp::DONT_CARE, vk::ImageLayout::DEPTH_STENCIL_READ_ONLY_OPTIMAL, vk::ImageLayout::DEPTH_STENCIL_READ_ONLY_OPTIMAL, true)))?,
            fin: pasada(&dev, Some((fmt_fin, vk::AttachmentLoadOp::CLEAR, vk::AttachmentStoreOp::STORE, vk::ImageLayout::UNDEFINED, vk::ImageLayout::PRESENT_SRC_KHR)), None)?,
            fin_propia: pasada(&dev, Some((FMT, vk::AttachmentLoadOp::CLEAR, vk::AttachmentStoreOp::STORE, vk::ImageLayout::UNDEFINED, vk::ImageLayout::TRANSFER_SRC_OPTIMAL)), None)?,
            refl: pasada(&dev, Some((FMT, vk::AttachmentLoadOp::CLEAR, vk::AttachmentStoreOp::STORE, vk::ImageLayout::UNDEFINED, vk::ImageLayout::SHADER_READ_ONLY_OPTIMAL)),
                Some((fmt_p, vk::AttachmentLoadOp::CLEAR, vk::AttachmentStoreOp::DONT_CARE, vk::ImageLayout::UNDEFINED, vk::ImageLayout::DEPTH_STENCIL_ATTACHMENT_OPTIMAL, false)))?,
        };

        // --- los sombreadores y las tuberías
        let modulo = |b: &[u8]| { let w = palabras(b); ve(dev.create_shader_module(&vk::ShaderModuleCreateInfo::default().code(&w), None), "sombreador") };
        let (m_luz, m_som, m_cielo, m_ao, m_post, m_ui, m_agua) = (modulo(SPV_LUZ)?, modulo(SPV_SOMBRA)?, modulo(SPV_CIELO)?, modulo(SPV_AO)?, modulo(SPV_POST)?, modulo(SPV_UI)?, modulo(SPV_AGUA)?);
        let (m_part, m_lin) = (modulo(SPV_PART)?, modulo(SPV_LIN)?);
        use vk::Format as F;
        let a_malla: &[(u32, u32, F, u32)] = &[(0, 0, F::R16G16B16A16_UNORM, 0), (1, 0, F::R8G8B8A8_SNORM, 8), (2, 0, F::R16G16_SFLOAT, 12)];
        let a_inst = |b: u32| -> Vec<(u32, u32, F, u32)> { (0..4).map(|k| (6 + k, b, F::R32G32B32A32_SFLOAT, 16 * k)).collect() };
        let a_piel = |b: u32| -> Vec<(u32, u32, F, u32)> { vec![(3, b, F::R8G8B8A8_UINT, 0), (4, b, F::R8G8B8A8_UNORM, 4)] };
        let mut at_luz = a_malla.to_vec(); at_luz.push((5, 1, F::R16G16_UNORM, 0)); at_luz.extend(a_inst(2));
        let mut at_luz_piel = at_luz.clone(); at_luz_piel.extend(a_piel(3));
        let mut at_som = vec![(0, 0, F::R16G16B16A16_UNORM, 0)]; at_som.extend(a_inst(1));
        let mut at_som_piel = at_som.clone(); at_som_piel.extend(a_piel(2));
        let b_luz = [(16, false), (4, false), (64, true)]; let b_luz_piel = [(16, false), (4, false), (64, true), (8, false)];
        let b_som = [(16, false), (64, true)]; let b_som_piel = [(16, false), (64, true), (8, false)];
        let le = vk::CompareOp::LESS_OR_EQUAL;
        let t = |m, vs: &str, fsn: Option<&str>, pl, rp, b: &[(u32, bool)], a: &[(u32, u32, F, u32)], mezcla: u8, prof: Option<(bool, vk::CompareOp, (f32, f32))>| tubo(&dev, m, vs, fsn, pl, rp, b, a, mezcla, prof);
        let mut luz = [vk::Pipeline::null(); 3]; let mut luz_piel = [vk::Pipeline::null(); 3];
        for k in 0..3 {
            // (lo opaco escribe la profundidad; lo transparente y lo que suma sólo la mira; van en la pasada de lo transparente)
            let (rp, esc) = if k == 0 { (pasadas.esc_ao, true) } else { (pasadas.transp, false) };
            luz[k] = t(m_luz, "vs_luz", Some("fs_luz"), planos.luz, rp, &b_luz, &at_luz, k as u8, Some((esc, le, SESGO_NO)))?;
            luz_piel[k] = t(m_luz, "vs_luz_piel", Some("fs_luz"), planos.luz_piel, rp, &b_luz_piel, &at_luz_piel, k as u8, Some((esc, le, SESGO_NO)))?;
        }
        let a_part = [(0, 0, F::R32G32B32_SFLOAT, 0), (1, 0, F::R32G32B32A32_SFLOAT, 12), (2, 0, F::R32G32B32_SFLOAT, 28), (3, 0, F::R32G32B32_SFLOAT, 40), (4, 0, F::R32G32B32_SFLOAT, 52)];
        // (lo opaco sin recorte: el sombreador sin descarte, así la profundidad se prueba antes de pintar)
        let luz_op = [t(m_luz, "vs_luz", Some("fs_luz_op"), planos.luz, pasadas.esc_ao, &b_luz, &at_luz, 0, Some((true, le, SESGO_NO)))?,
            t(m_luz, "vs_luz_piel", Some("fs_luz_op"), planos.luz_piel, pasadas.esc_ao, &b_luz_piel, &at_luz_piel, 0, Some((true, le, SESGO_NO)))?];
        // (la pasada de profundidad: lo opaco sin recorte, sin color —mezcla 4—; después la luz pinta cada píxel una vez)
        let pre = [t(m_luz, "vs_luz", None, planos.luz, pasadas.esc_ao, &b_luz, &at_luz, 4, Some((true, le, SESGO_NO)))?,
            t(m_luz, "vs_luz_piel", None, planos.luz_piel, pasadas.esc_ao, &b_luz_piel, &at_luz_piel, 4, Some((true, le, SESGO_NO)))?];
        // (la caja de la oclusión: se prueba contra la profundidad sin escribir nada)
        let caja = t(m_som, "vs_sombra", None, planos.sombra, pasadas.esc_ao, &b_som, &at_som, 4, Some((false, le, SESGO_NO)))?;
        let part_t = |mz: u8| t(m_part, "vs_part", Some("fs_part"), planos.part, pasadas.transp, &[((PART_F * 4) as u32, true)], &a_part, mz, Some((false, le, SESGO_NO)));
        let tubos = Tubos {
            luz, luz_piel, luz_op, pre, caja,
            sombra: t(m_som, "vs_sombra", None, planos.sombra, pasadas.sombra, &b_som, &at_som, 0, Some((true, le, SESGO_SOMBRA)))?,
            sombra_piel: t(m_som, "vs_sombra_piel", None, planos.sombra_piel, pasadas.sombra, &b_som_piel, &at_som_piel, 0, Some((true, le, SESGO_SOMBRA)))?,
            cielo: t(m_cielo, "vs_cielo", Some("fs_cielo"), planos.cielo, pasadas.esc_ao, &[], &[], 0, Some((false, le, SESGO_NO)))?,
            ao: t(m_ao, "vs_pantalla", Some("fs_ao"), planos.ao, pasadas.ao, &[], &[], 0, None)?,
            ao_poner: t(m_post, "vs_pantalla", Some("fs_ao_poner"), planos.tex1, pasadas.transp, &[], &[], 3, Some((false, vk::CompareOp::ALWAYS, SESGO_NO)))?,
            fin: t(m_post, "vs_final", Some("fs_final"), planos.tex1, if ventana.is_some() { pasadas.fin } else { pasadas.fin_propia }, &[], &[], 0, None)?,
            ui: t(m_ui, "vs_ui", Some("fs_ui"), planos.tex1, if ventana.is_some() { pasadas.fin } else { pasadas.fin_propia }, &[(32, false)], &[(0, 0, F::R32G32_SFLOAT, 0), (1, 0, F::R32G32_SFLOAT, 8), (2, 0, F::R32G32B32A32_SFLOAT, 16)], 1, None)?,
            agua: t(m_agua, "vs_agua", Some("fs_agua"), planos.agua, pasadas.transp, &b_som, &at_som, 1, Some((false, le, SESGO_NO)))?,
            // (las partículas: una instancia por partícula, la fila de 16 floats; miran la profundidad sin escribirla. Las marcas:
            // triángulos con su color, despegadas hacia la cámara con el sesgo)
            part: [part_t(1)?, part_t(2)?],
            marcas: t(m_lin, "vs_lin", Some("fs_lin"), planos.lin, pasadas.transp, &[((MARCA_F * 4) as u32, false)], &[(0, 0, F::R32G32B32_SFLOAT, 0), (1, 0, F::R32G32B32A32_SFLOAT, 12)], 1, Some((false, le, SESGO_MARCAS)))?,
            fmt_fin,
        };
        let mods = vec![m_luz, m_som, m_cielo, m_ao, m_post, m_ui, m_agua, m_part, m_lin];

        let muestra = |rep: bool, mips: bool, cmp: bool| {
            let am = if rep { vk::SamplerAddressMode::REPEAT } else { vk::SamplerAddressMode::CLAMP_TO_EDGE };
            ve(dev.create_sampler(&vk::SamplerCreateInfo::default().mag_filter(vk::Filter::LINEAR).min_filter(vk::Filter::LINEAR)
                .mipmap_mode(if mips { vk::SamplerMipmapMode::LINEAR } else { vk::SamplerMipmapMode::NEAREST })
                .address_mode_u(am).address_mode_v(am).address_mode_w(am).max_lod(if mips { vk::LOD_CLAMP_NONE } else { 0.25 })
                .compare_enable(cmp).compare_op(vk::CompareOp::LESS_OR_EQUAL), None), "muestreador")
        };
        let (s_rep, s_cla, s_cmp) = (muestra(true, true, false)?, muestra(false, false, false)?, muestra(false, false, true)?);
        let pool_mat = { let ps = [vk::DescriptorPoolSize { ty: DT::SAMPLED_IMAGE, descriptor_count: 4096 * 5 }, vk::DescriptorPoolSize { ty: DT::SAMPLER, descriptor_count: 4096 * 2 }];
            ve(dev.create_descriptor_pool(&vk::DescriptorPoolCreateInfo::default().max_sets(4096).pool_sizes(&ps), None), "pool de materiales")? };
        let cbs = ve(dev.allocate_command_buffers(&vk::CommandBufferAllocateInfo::default().command_pool(cmd_pool).level(vk::CommandBufferLevel::PRIMARY).command_buffer_count(MARCOS as u32)), "órdenes")?;
        let periodo = if ts_bits > 0 && props.limits.timestamp_period > 0.0 { props.limits.timestamp_period } else { 0.0 };
        let mut m = Motor {
            _entry: entry, inst, dev, pd, q, _qf: qf, mem_props, sup_i, sup, sc_d, cadena: None, propia: None, rehacer: false, op, cmd_pool,
            marcos: vec![], marco: 0, capas, planos, pasadas, tubos, mods, s_rep, s_cla, s_cmp, fmt_p, fmt_s,
            blanca: Img::nula(), cubo0: Img::nula(), prof0: Img::nula(),
            mallas: HashMap::new(), mats: HashMap::new(), texs: HashMap::new(), lms: HashMap::new(), cielo: None, cubo: None, agua: None, agua_n: None, agua_p: None, aguas: vec![],
            pool_mat, g_mat: HashMap::new(), sombra: None, dest: None,
            svp: mat::id(), sesgo: [0.0; 2], svp2: mat::id(), sesgo2: [0.0; 2], refl_piso: None, sombra_huella: [0; 2], oclu: HashMap::new(), caja: None, c: None, items: vec![], opacos: vec![], transp: vec![], marcas: vec![], marcas_ver: 0,
            cuadro: 0, dibujos: 0, memoria: 0, mapa: String::new(), placa, periodo, tiempos: vec![],
        };
        for cb in cbs {
            let hv = vk::MemoryPropertyFlags::HOST_VISIBLE | vk::MemoryPropertyFlags::HOST_COHERENT;
            let ub = vk::BufferUsageFlags::UNIFORM_BUFFER; let vb = vk::BufferUsageFlags::VERTEX_BUFFER;
            let q = if m.periodo > 0.0 { Some(ve(m.dev.create_query_pool(&vk::QueryPoolCreateInfo::default().query_type(vk::QueryType::TIMESTAMP).query_count(NTIEMPOS), None), "tiempos")?) } else { None };
            let mc = Marco {
                cb, listo: ve(m.dev.create_fence(&vk::FenceCreateInfo::default().flags(vk::FenceCreateFlags::SIGNALED), None), "valla")?,
                sem_img: ve(m.dev.create_semaphore(&vk::SemaphoreCreateInfo::default(), None), "semáforo")?, pool: pool_cuadro(&m.dev)?,
                glob: m.buf(G_PASO * 4, ub, hv)?, obj: m.buf(65536, ub, hv)?, hue: m.buf(65536, ub, hv)?, inst: m.buf(65536, vb, hv)?,
                post: m.buf(U_PASO * 2, ub, hv)?, ui: m.buf(65536, vb, hv)?, uiu: m.buf(U_PASO, ub, hv)?,
                part: m.buf(65536, vb, hv)?, partu: m.buf(U_PASO * 4, ub, hv)?, marcas: m.buf(65536, vb, hv)?, marcas_ver: 0, q, nombres: vec![], usado: false,
                oq: ve(m.dev.create_query_pool(&vk::QueryPoolCreateInfo::default().query_type(vk::QueryType::OCCLUSION).query_count(OCLU_MAX), None), "oclusión")?, oq_claves: vec![],
            };
            m.marcos.push(mc);
        }
        // (las texturas de relleno: blanca, un cubo blanco y una profundidad de 1×1 lista para leer)
        m.blanca = m.textura(1, 1, &[255; 4], false)?;
        m.cubo0 = m.cubo(1, &[&[255u8; 4][..]; 6])?;
        m.prof0 = m.img(1, 1, m.fmt_s, vk::ImageUsageFlags::DEPTH_STENCIL_ATTACHMENT | vk::ImageUsageFlags::SAMPLED, vk::ImageAspectFlags::DEPTH, 1, 1)?;
        let p0 = m.prof0.i;
        m.una_vez(|d, cb| barrera(d, cb, p0, vk::ImageAspectFlags::DEPTH, vk::ImageLayout::UNDEFINED, vk::ImageLayout::DEPTH_STENCIL_READ_ONLY_OPTIMAL, 0, 1, 1))?;
        if ventana.is_some() { m.hacer_cadena()?; } else { m.hacer_propia(w, h)?; }
        Ok(m)
    }

    /// el tamaño en que se dibuja (el de la pantalla de costado si está girada)
    pub fn tam(&self) -> (u32, u32) {
        if let Some(c) = &self.cadena { if c.giro % 180 == 90 { (c.ext.height, c.ext.width) } else { (c.ext.width, c.ext.height) } }
        else if let Some(p) = &self.propia { (p.img.w, p.img.h) } else { (1, 1) }
    }

    // ———— memoria, búferes e imágenes ————
    fn tipo_mem(&self, bits: u32, quiero: vk::MemoryPropertyFlags) -> Option<u32> {
        (0..self.mem_props.memory_type_count).find(|&i| bits & (1 << i) != 0 && self.mem_props.memory_types[i as usize].property_flags.contains(quiero))
    }
    unsafe fn buf(&self, tam: u64, uso: vk::BufferUsageFlags, props: vk::MemoryPropertyFlags) -> Result<Bufv, String> {
        let b = ve(self.dev.create_buffer(&vk::BufferCreateInfo::default().size(tam.max(16)).usage(uso).sharing_mode(vk::SharingMode::EXCLUSIVE), None), "búfer")?;
        let req = self.dev.get_buffer_memory_requirements(b);
        let t = self.tipo_mem(req.memory_type_bits, props).ok_or("sin memoria para el búfer")?;
        let m = ve(self.dev.allocate_memory(&vk::MemoryAllocateInfo::default().allocation_size(req.size).memory_type_index(t), None), "memoria")?;
        ve(self.dev.bind_buffer_memory(b, m, 0), "bind")?;
        let ptr = if props.contains(vk::MemoryPropertyFlags::HOST_VISIBLE) { ve(self.dev.map_memory(m, 0, vk::WHOLE_SIZE, vk::MemoryMapFlags::empty()), "map")? as *mut u8 } else { std::ptr::null_mut() };
        Ok(Bufv { b, m, tam: tam.max(16), ptr })
    }
    unsafe fn soltar_buf(&self, b: &Bufv) { self.dev.destroy_buffer(b.b, None); self.dev.free_memory(b.m, None); }
    /// un búfer fijo (mallas) con sus bytes: en la memoria de la placa que la CPU ve (los teléfonos la tienen) o, si no hay,
    /// pasando por uno intermedio
    unsafe fn buf_fijo(&self, datos: &[u8], uso: vk::BufferUsageFlags) -> Result<Bufv, String> {
        let dl = vk::MemoryPropertyFlags::DEVICE_LOCAL; let hv = vk::MemoryPropertyFlags::HOST_VISIBLE | vk::MemoryPropertyFlags::HOST_COHERENT;
        let unif = self.tipo_mem(!0, dl | hv).is_some();
        if unif {
            let b = self.buf(datos.len() as u64, uso, dl | hv)?;
            std::ptr::copy_nonoverlapping(datos.as_ptr(), b.ptr, datos.len()); Ok(b)
        } else {
            let st = self.buf(datos.len() as u64, vk::BufferUsageFlags::TRANSFER_SRC, hv)?;
            std::ptr::copy_nonoverlapping(datos.as_ptr(), st.ptr, datos.len());
            let b = self.buf(datos.len() as u64, uso | vk::BufferUsageFlags::TRANSFER_DST, dl)?;
            let (sb, db, n) = (st.b, b.b, datos.len() as u64);
            self.una_vez(|d, cb| d.cmd_copy_buffer(cb, sb, db, &[vk::BufferCopy { src_offset: 0, dst_offset: 0, size: n }]))?;
            self.soltar_buf(&st); Ok(b)
        }
    }
    unsafe fn img(&self, w: u32, h: u32, fmt: vk::Format, uso: vk::ImageUsageFlags, aspecto: vk::ImageAspectFlags, niveles: u32, capas: u32) -> Result<Img, String> {
        let cubo = capas == 6;
        let i = ve(self.dev.create_image(&vk::ImageCreateInfo::default().image_type(vk::ImageType::TYPE_2D).format(fmt).extent(vk::Extent3D { width: w, height: h, depth: 1 })
            .mip_levels(niveles).array_layers(capas).samples(vk::SampleCountFlags::TYPE_1).tiling(vk::ImageTiling::OPTIMAL).usage(uso)
            .flags(if cubo { vk::ImageCreateFlags::CUBE_COMPATIBLE } else { vk::ImageCreateFlags::empty() }).initial_layout(vk::ImageLayout::UNDEFINED), None), "imagen")?;
        let req = self.dev.get_image_memory_requirements(i);
        // (los destinos que se borran y no se guardan pueden vivir sólo en la placa: memoria «perezosa» de los teléfonos)
        let perezosa = uso.contains(vk::ImageUsageFlags::TRANSIENT_ATTACHMENT);
        let t = (if perezosa { self.tipo_mem(req.memory_type_bits, vk::MemoryPropertyFlags::LAZILY_ALLOCATED) } else { None })
            .or_else(|| self.tipo_mem(req.memory_type_bits, vk::MemoryPropertyFlags::DEVICE_LOCAL)).or_else(|| self.tipo_mem(req.memory_type_bits, vk::MemoryPropertyFlags::empty())).ok_or("sin memoria para la imagen")?;
        let m = ve(self.dev.allocate_memory(&vk::MemoryAllocateInfo::default().allocation_size(req.size).memory_type_index(t), None), "memoria")?;
        ve(self.dev.bind_image_memory(i, m, 0), "bind")?;
        let v = ve(self.dev.create_image_view(&vk::ImageViewCreateInfo::default().image(i).view_type(if cubo { vk::ImageViewType::CUBE } else { vk::ImageViewType::TYPE_2D }).format(fmt)
            .subresource_range(vk::ImageSubresourceRange { aspect_mask: aspecto, base_mip_level: 0, level_count: niveles, base_array_layer: 0, layer_count: capas }), None), "vista")?;
        Ok(Img { i, m, v, w, h, bytes: req.size as usize })
    }
    unsafe fn soltar_img(&self, i: &Img) { if i.i != vk::Image::null() { self.dev.destroy_image_view(i.v, None); self.dev.destroy_image(i.i, None); self.dev.free_memory(i.m, None); } }
    /// unas órdenes que se hacen ya (subir recursos): se espera a que terminen
    unsafe fn una_vez(&self, f: impl FnOnce(&ash::Device, vk::CommandBuffer)) -> Result<(), String> {
        let cb = ve(self.dev.allocate_command_buffers(&vk::CommandBufferAllocateInfo::default().command_pool(self.cmd_pool).level(vk::CommandBufferLevel::PRIMARY).command_buffer_count(1)), "órdenes")?[0];
        ve(self.dev.begin_command_buffer(cb, &vk::CommandBufferBeginInfo::default().flags(vk::CommandBufferUsageFlags::ONE_TIME_SUBMIT)), "begin")?;
        f(&self.dev, cb);
        ve(self.dev.end_command_buffer(cb), "end")?;
        let fe = ve(self.dev.create_fence(&vk::FenceCreateInfo::default(), None), "valla")?;
        let cbs = [cb];
        ve(self.dev.queue_submit(self.q, &[vk::SubmitInfo::default().command_buffers(&cbs)], fe), "submit")?;
        let r = self.dev.wait_for_fences(&[fe], true, u64::MAX);
        self.dev.destroy_fence(fe, None); self.dev.free_command_buffers(self.cmd_pool, &cbs);
        ve(r, "espera")
    }
    /// una textura RGBA8 con sus niveles (promediando de a 4, como glGenerateMipmap)
    unsafe fn textura(&self, w: u32, h: u32, px: &[u8], mips: bool) -> Result<Img, String> {
        let niveles = if mips { 32 - w.max(h).max(1).leading_zeros() } else { 1 };
        let im = self.img(w, h, FMT, vk::ImageUsageFlags::SAMPLED | vk::ImageUsageFlags::TRANSFER_DST, vk::ImageAspectFlags::COLOR, niveles, 1)?;
        let mut todo = vec![]; let mut partes = vec![]; let (mut cw, mut ch, mut cur) = (w, h, px.to_vec());
        for nv in 0..niveles {
            partes.push((todo.len() as u64, cw, ch, nv)); todo.extend_from_slice(&cur);
            if nv + 1 < niveles { let (nw, nh) = ((cw / 2).max(1), (ch / 2).max(1)); cur = crate::vk::mitad(&cur, cw, ch, nw, nh); cw = nw; ch = nh; }
        }
        self.subir_img(&im, &todo, &partes, 1)?;
        Ok(Img { bytes: todo.len(), ..im })
    }
    unsafe fn cubo(&self, l: u32, caras: &[&[u8]]) -> Result<Img, String> {
        let im = self.img(l, l, FMT, vk::ImageUsageFlags::SAMPLED | vk::ImageUsageFlags::TRANSFER_DST, vk::ImageAspectFlags::COLOR, 1, 6)?;
        let mut todo = vec![]; for c in caras.iter().take(6) { todo.extend_from_slice(c); }
        let partes: Vec<_> = (0..6).map(|f| ((f * l * l * 4) as u64, l, l, 0u32)).collect();
        // (las 6 caras: una copia por capa)
        let st = self.buf(todo.len() as u64, vk::BufferUsageFlags::TRANSFER_SRC, vk::MemoryPropertyFlags::HOST_VISIBLE | vk::MemoryPropertyFlags::HOST_COHERENT)?;
        std::ptr::copy_nonoverlapping(todo.as_ptr(), st.ptr, todo.len());
        let (sb, ii) = (st.b, im.i);
        self.una_vez(|d, cb| {
            barrera(d, cb, ii, vk::ImageAspectFlags::COLOR, vk::ImageLayout::UNDEFINED, vk::ImageLayout::TRANSFER_DST_OPTIMAL, 0, 1, 6);
            let cs: Vec<_> = partes.iter().enumerate().map(|(f, &(o, w, h, _))| vk::BufferImageCopy { buffer_offset: o, buffer_row_length: 0, buffer_image_height: 0,
                image_subresource: vk::ImageSubresourceLayers { aspect_mask: vk::ImageAspectFlags::COLOR, mip_level: 0, base_array_layer: f as u32, layer_count: 1 }, image_offset: vk::Offset3D::default(), image_extent: vk::Extent3D { width: w, height: h, depth: 1 } }).collect();
            d.cmd_copy_buffer_to_image(cb, sb, ii, vk::ImageLayout::TRANSFER_DST_OPTIMAL, &cs);
            barrera(d, cb, ii, vk::ImageAspectFlags::COLOR, vk::ImageLayout::TRANSFER_DST_OPTIMAL, vk::ImageLayout::SHADER_READ_ONLY_OPTIMAL, 0, 1, 6);
        })?;
        self.soltar_buf(&st);
        Ok(Img { bytes: todo.len(), ..im })
    }
    unsafe fn subir_img(&self, im: &Img, todo: &[u8], partes: &[(u64, u32, u32, u32)], capas: u32) -> Result<(), String> {
        let st = self.buf(todo.len() as u64, vk::BufferUsageFlags::TRANSFER_SRC, vk::MemoryPropertyFlags::HOST_VISIBLE | vk::MemoryPropertyFlags::HOST_COHERENT)?;
        std::ptr::copy_nonoverlapping(todo.as_ptr(), st.ptr, todo.len());
        let (sb, ii, nv) = (st.b, im.i, partes.len() as u32);
        self.una_vez(|d, cb| {
            barrera(d, cb, ii, vk::ImageAspectFlags::COLOR, vk::ImageLayout::UNDEFINED, vk::ImageLayout::TRANSFER_DST_OPTIMAL, 0, nv, capas);
            let cs: Vec<_> = partes.iter().map(|&(o, w, h, l)| vk::BufferImageCopy { buffer_offset: o, buffer_row_length: 0, buffer_image_height: 0,
                image_subresource: vk::ImageSubresourceLayers { aspect_mask: vk::ImageAspectFlags::COLOR, mip_level: l, base_array_layer: 0, layer_count: capas }, image_offset: vk::Offset3D::default(), image_extent: vk::Extent3D { width: w, height: h, depth: 1 } }).collect();
            d.cmd_copy_buffer_to_image(cb, sb, ii, vk::ImageLayout::TRANSFER_DST_OPTIMAL, &cs);
            barrera(d, cb, ii, vk::ImageAspectFlags::COLOR, vk::ImageLayout::TRANSFER_DST_OPTIMAL, vk::ImageLayout::SHADER_READ_ONLY_OPTIMAL, 0, nv, capas);
        })?;
        self.soltar_buf(&st); Ok(())
    }

    // ———— la salida ————
    unsafe fn hacer_cadena(&mut self) -> Result<(), String> {
        let si = self.sup_i.as_ref().unwrap(); let scd = self.sc_d.as_ref().unwrap();
        let cap = ve(si.get_physical_device_surface_capabilities(self.pd, self.sup), "capacidades")?;
        // (el giro que tiene la pantalla: el juego lo hace en la imagen final y el sistema no tiene que girar nada)
        let tr = cap.current_transform;
        let giro = if tr.contains(vk::SurfaceTransformFlagsKHR::ROTATE_90) { 90 } else if tr.contains(vk::SurfaceTransformFlagsKHR::ROTATE_180) { 180 } else if tr.contains(vk::SurfaceTransformFlagsKHR::ROTATE_270) { 270 } else { 0 };
        let pre = if giro == 0 { vk::SurfaceTransformFlagsKHR::IDENTITY } else { tr };
        let mut ext = cap.current_extent;
        if ext.width == u32::MAX { ext = vk::Extent2D { width: 1280, height: 720 }; }
        // (la superficie dice el tamaño como se ve; la cadena girada por el juego va con el de la pantalla sin girar —como
        // lo indica Android para el preTransform—)
        if giro % 180 == 90 { ext = vk::Extent2D { width: ext.height, height: ext.width }; }
        let n = (cap.min_image_count + 1).max(3).min(if cap.max_image_count > 0 { cap.max_image_count } else { 8 });
        let alfa = [vk::CompositeAlphaFlagsKHR::OPAQUE, vk::CompositeAlphaFlagsKHR::INHERIT, vk::CompositeAlphaFlagsKHR::PRE_MULTIPLIED, vk::CompositeAlphaFlagsKHR::POST_MULTIPLIED].into_iter().find(|a| cap.supported_composite_alpha.contains(*a)).unwrap_or(vk::CompositeAlphaFlagsKHR::OPAQUE);
        let vieja = self.cadena.as_ref().map(|c| c.sc).unwrap_or(vk::SwapchainKHR::null());
        let sc = ve(scd.create_swapchain(&vk::SwapchainCreateInfoKHR::default().surface(self.sup).min_image_count(n).image_format(self.tubos.fmt_fin).image_color_space(vk::ColorSpaceKHR::SRGB_NONLINEAR)
            .image_extent(ext).image_array_layers(1).image_usage(vk::ImageUsageFlags::COLOR_ATTACHMENT).image_sharing_mode(vk::SharingMode::EXCLUSIVE)
            .pre_transform(pre).composite_alpha(alfa).present_mode(vk::PresentModeKHR::FIFO).clipped(true).old_swapchain(vieja), None), "cadena")?;
        if let Some(c) = self.cadena.take() { self.soltar_cadena(c); }
        let imgs = ve(scd.get_swapchain_images(sc), "imágenes")?;
        let mut vistas = vec![]; let mut fbs = vec![]; let mut sems = vec![];
        for &i in &imgs {
            let v = ve(self.dev.create_image_view(&vk::ImageViewCreateInfo::default().image(i).view_type(vk::ImageViewType::TYPE_2D).format(self.tubos.fmt_fin)
                .subresource_range(vk::ImageSubresourceRange { aspect_mask: vk::ImageAspectFlags::COLOR, base_mip_level: 0, level_count: 1, base_array_layer: 0, layer_count: 1 }), None), "vista")?;
            let at = [v];
            fbs.push(ve(self.dev.create_framebuffer(&vk::FramebufferCreateInfo::default().render_pass(self.pasadas.fin).attachments(&at).width(ext.width).height(ext.height).layers(1), None), "fb")?);
            vistas.push(v); sems.push(ve(self.dev.create_semaphore(&vk::SemaphoreCreateInfo::default(), None), "semáforo")?);
        }
        self.cadena = Some(Cadena { sc, imgs, vistas, fbs, sems, fmt: self.tubos.fmt_fin, ext, giro });
        self.rehacer = false;
        Ok(())
    }
    unsafe fn soltar_cadena(&self, c: Cadena) {
        for f in c.fbs { self.dev.destroy_framebuffer(f, None); }
        for v in c.vistas { self.dev.destroy_image_view(v, None); }
        for s in c.sems { self.dev.destroy_semaphore(s, None); }
        let _ = (c.imgs, c.fmt);
        self.sc_d.as_ref().unwrap().destroy_swapchain(c.sc, None);
    }
    unsafe fn hacer_propia(&mut self, w: u32, h: u32) -> Result<(), String> {
        let img = self.img(w, h, FMT, vk::ImageUsageFlags::COLOR_ATTACHMENT | vk::ImageUsageFlags::TRANSFER_SRC, vk::ImageAspectFlags::COLOR, 1, 1)?;
        let at = [img.v];
        let fb = ve(self.dev.create_framebuffer(&vk::FramebufferCreateInfo::default().render_pass(self.pasadas.fin_propia).attachments(&at).width(w).height(h).layers(1), None), "fb")?;
        let leer = self.buf((w * h * 4) as u64, vk::BufferUsageFlags::TRANSFER_DST, vk::MemoryPropertyFlags::HOST_VISIBLE | vk::MemoryPropertyFlags::HOST_COHERENT)?;
        self.propia = Some(Propia { img, fb, leer });
        Ok(())
    }
    /// la imagen del último cuadro (sin ventana): RGBA, la primera fila arriba
    pub unsafe fn leer_imagen(&mut self) -> Option<Vec<u8>> {
        let _ = self.dev.device_wait_idle();
        let p = self.propia.as_ref()?; let n = (p.img.w * p.img.h * 4) as usize;
        Some(std::slice::from_raw_parts(p.leer.ptr, n).to_vec())
    }

    // ———— los recursos ————
    /// sube a la placa los recursos nuevos (los que ya estaban con el mismo número se reemplazan)
    pub unsafe fn cargar(&mut self, esc: &Escena) -> Result<(), String> {
        self.sombra_huella = [0; 2]; self.oclu.clear();
        let _ = self.dev.device_wait_idle();
        let rango = |o: usize, n: usize| -> Result<&[u8], String> { esc.datos.get(o..o + n).ok_or_else(|| format!("bloque fuera del archivo ({o}+{n} de {})", esc.datos.len())) };
        let mut max_v = 0usize;
        for m in &esc.c.mallas {
            // (los vértices vienen de a 14 bytes —posición u16×3, normal i8×4, uv f16×2—; la placa los quiere de a 4: 16)
            let src = rango(m.vo, m.v as usize * 14)?; let mut vv = vec![0u8; m.v as usize * 16];
            for (i, c) in src.chunks_exact(14).enumerate() { let o = i * 16; vv[o..o + 6].copy_from_slice(&c[0..6]); vv[o + 8..o + 16].copy_from_slice(&c[6..14]); }
            let nib = m.ni as usize * if m.i32 != 0 { 4 } else { 2 };
            let vb = self.buf_fijo(&vv, vk::BufferUsageFlags::VERTEX_BUFFER)?;
            let ib = self.buf_fijo(rango(m.io, nib)?, vk::BufferUsageFlags::INDEX_BUFFER)?;
            let lm = if m.lo >= 0 { Some(self.buf_fijo(rango(m.lo as usize, m.v as usize * 4)?, vk::BufferUsageFlags::VERTEX_BUFFER)?) } else { max_v = max_v.max(m.v as usize); None };
            let piel = if m.so >= 0 { Some(self.buf_fijo(rango(m.so as usize, m.v as usize * 8)?, vk::BufferUsageFlags::VERTEX_BUFFER)?) } else { None };
            let bytes = vv.len() + nib + if m.lo >= 0 { m.v as usize * 4 } else { 0 } + if m.so >= 0 { m.v as usize * 8 } else { 0 };
            if let Some(v) = self.mallas.insert(m.id, MallaV { vb, ib, lm, piel, i32: m.i32 != 0, mn: m.mn, sc: m.sc, lm_id: m.lm, bytes }) { self.memoria -= v.bytes; self.soltar_malla(&v); }
            self.memoria += bytes;
        }
        // (las mallas sin luz horneada leen ceros: un búfer compartido con lugar para la más grande —se guarda como la luz
        // horneada de la malla -1—)
        if max_v > 0 { let ceros = vec![0u8; max_v * 4 + 64]; let b = self.buf_fijo(&ceros, vk::BufferUsageFlags::VERTEX_BUFFER)?;
            if let Some(v) = self.mallas.get_mut(&i64::MIN) { let viejo = std::mem::replace(&mut v.vb, b); self.soltar_buf(&viejo); }
            else { let ib = self.buf_fijo(&[0u8; 16], vk::BufferUsageFlags::INDEX_BUFFER)?; self.mallas.insert(i64::MIN, MallaV { vb: b, ib, lm: None, piel: None, i32: false, mn: [0.0; 3], sc: [0.0; 3], lm_id: -1, bytes: 0 }); } }
        let mut cambio = false;
        for t in &esc.c.texs {
            let n = (t.w * t.h * 4) as usize; let tx = self.textura(t.w, t.h, rango(t.o, n)?, true)?;
            self.memoria += tx.bytes; cambio = true;
            if let Some(v) = self.texs.insert(t.id, tx) { self.memoria -= v.bytes; self.soltar_img(&v); }
        }
        for t in &esc.c.lms {
            let n = (t.w * t.h * 4) as usize; let tx = self.textura(t.w, t.h, rango(t.o, n)?, false)?;
            self.memoria += tx.bytes; cambio = true;
            if let Some(v) = self.lms.insert(t.id, tx) { self.memoria -= v.bytes; self.soltar_img(&v); }
        }
        if cambio { self.g_mat.clear(); ve(self.dev.reset_descriptor_pool(self.pool_mat, vk::DescriptorPoolResetFlags::empty()), "pool")?; }
        for m in &esc.c.mats { self.mats.insert(m.id, m.clone()); }
        if let Some(a) = &esc.c.agua {
            if let Some(n) = &a.normal { let t = self.textura(n.w, n.h, rango(n.o, (n.w * n.h * 4) as usize)?, true)?; if let Some(v) = self.agua_n.replace(t) { self.soltar_img(&v); } }
            if let Some(p) = a.prof.as_ref().and_then(|p| p.tex.as_ref()) { let t = self.textura(p.w, p.h, rango(p.o, (p.w * p.h * 4) as usize)?, false)?; if let Some(v) = self.agua_p.replace(t) { self.soltar_img(&v); } }
            let mut a2 = a.clone(); a2.normal = None; if let Some(p) = a2.prof.as_mut() { p.tex = None; } self.agua = Some(a2);
        }
        if let Some(c) = &esc.c.cielo {
            if let Some(cr) = &c.caras {
                let n = (cr.l * cr.l * 4) as usize; let mut caras = vec![];
                for &o in cr.o.iter().take(6) { caras.push(rango(o, n)?); }
                if caras.len() == 6 { let cu = self.cubo(cr.l, &caras)?; if let Some(v) = self.cubo.replace(cu) { self.soltar_img(&v); } }
            }
            let mut c2 = c.clone(); c2.caras = None; self.cielo = Some(c2);
        }
        if !esc.c.mapa.is_empty() { self.mapa = esc.c.mapa.clone(); }
        Ok(())
    }
    unsafe fn soltar_malla(&self, m: &MallaV) {
        self.soltar_buf(&m.vb); self.soltar_buf(&m.ib);
        if let Some(b) = &m.lm { self.soltar_buf(b); } if let Some(b) = &m.piel { self.soltar_buf(b); }
    }
    /// borra todo lo cargado (cambio de mapa)
    pub unsafe fn vaciar(&mut self) {
        let _ = self.dev.device_wait_idle();
        for (_, m) in self.mallas.drain().collect::<Vec<_>>() { self.soltar_malla(&m); }
        for (_, t) in self.texs.drain().collect::<Vec<_>>() { self.soltar_img(&t); }
        for (_, t) in self.lms.drain().collect::<Vec<_>>() { self.soltar_img(&t); }
        if let Some(c) = self.cubo.take() { self.soltar_img(&c); }
        for t in [self.agua_n.take(), self.agua_p.take()].into_iter().flatten() { self.soltar_img(&t); } self.agua = None;
        self.g_mat.clear(); let _ = self.dev.reset_descriptor_pool(self.pool_mat, vk::DescriptorPoolResetFlags::empty());
        self.mats.clear(); self.cielo = None; self.memoria = 0; self.c = None; self.items.clear();
    }

    /// el cuadro que sigue: qué se ve (recorte por la cámara) y en qué pasada va cada cosa
    pub fn poner_cuadro(&mut self, mut c: Cuadro) {
        let pl = mat::planos(&c.vp);
        self.items = std::mem::take(&mut c.items);
        // (las marcas llegan sólo cuando cambian: quedan acá —el último bloque, si vinieran dos—)
        while let Some(i) = c.efectos.iter().position(|e| e.0 == EF_MARCAS) { self.marcas = c.efectos.remove(i).1; self.marcas_ver += 1; }
        self.opacos.clear(); self.transp.clear(); self.aguas.clear();
        for (i, it) in self.items.iter().enumerate() {
            let (Some(_), Some(mt)) = (self.mallas.get(&it.m), self.mats.get(&it.mat)) else { continue };
            if !mat::esfera_dentro(&pl, &it.esf) { continue; }
            if mt.agua != 0 { self.aguas.push(i) } else if mt.blend != 0 || mt.add != 0 { self.transp.push(i) } else { self.opacos.push(i) }
        }
        let (mallas, mats, items) = (&self.mallas, &self.mats, &self.items);
        let clave = |it: &ItemDin| (!it.h.is_empty() && mallas[&it.m].piel.is_some(), mats[&it.mat].t, it.m, it.s0, it.mat);
        self.opacos.sort_by_key(|&i| clave(&items[i]));
        let d2 = |it: &ItemDin| { let e = it.esf; let (x, y, z) = (e[0] - c.pos[0], e[1] - c.pos[1], e[2] - c.pos[2]); x * x + y * y + z * z };
        self.transp.sort_by(|&a, &b| d2(&items[b]).partial_cmp(&d2(&items[a])).unwrap_or(std::cmp::Ordering::Equal));
        self.c = Some(c);
    }
    fn sol(&self) -> [f32; 3] { mat::norm(self.c.as_ref().map(|c| c.luz.sol).unwrap_or([0.3, 0.8, 0.2])) }

    /// la cabecera de una pasada (la misma que wg.rs)
    fn glob(&self, vp: &M4, clip: f32, g: &mut [f32]) {
        let c = self.c.as_ref().unwrap(); let l = &c.luz; let s = self.sol(); let cp = c.pos;
        g[0..16].copy_from_slice(vp); g[16..32].copy_from_slice(&self.svp); g[32..48].copy_from_slice(&mat::inv(vp));
        g[48..52].copy_from_slice(&[cp[0], cp[1], cp[2], l.expo]);
        g[52..56].copy_from_slice(&[s[0], s[1], s[2], if self.op.sombras && self.sombra.is_some() { 1.0 } else { 0.0 }]);
        g[56..60].copy_from_slice(&[l.sol_c[0], l.sol_c[1], l.sol_c[2], clip]);
        let (top, mid, bot, ex, k) = self.cielo.as_ref().map(|c| (c.top, c.mid, c.bot, c.exp, c.k)).unwrap_or(([0.28, 0.64, 1.0], [0.92, 0.92, 0.92], [0.53, 0.58, 0.68], [0.5, 0.5], 1.0));
        let t = if c.tiempo > 0.0 { c.tiempo } else { self.cuadro as f32 / 60.0 };
        g[60..64].copy_from_slice(&[l.amb_s[0], l.amb_s[1], l.amb_s[2], k]);
        g[64..68].copy_from_slice(&[l.amb_g[0], l.amb_g[1], l.amb_g[2], t]);
        g[68..72].copy_from_slice(&[l.nie.c[0], l.nie.c[1], l.nie.c[2], 0.0]);
        g[72..76].copy_from_slice(&[l.nie.a, l.nie.b, if l.nie.m > 0.0 { l.nie.m } else { 1.0 }, 0.0]);
        g[76..80].copy_from_slice(&[l.nie.s[0], l.nie.s[1], l.nie.s[2], 0.0]);
        let (nl, ne) = (c.luces.len().min(MAX_LUCES), c.esp.len().min(MAX_LUCES - c.luces.len().min(MAX_LUCES)));
        g[80..84].copy_from_slice(&[self.sesgo[0], self.sesgo[1], (nl + ne) as f32, nl as f32]);
        g[84..88].copy_from_slice(&[top[0], top[1], top[2], ex[0]]); g[88..92].copy_from_slice(&[mid[0], mid[1], mid[2], ex[1]]); g[92..96].copy_from_slice(&[bot[0], bot[1], bot[2], 0.0]);
        for (i, q) in c.luces.iter().take(nl).chain(c.esp.iter().take(ne)).enumerate() {
            for k in 0..3 { g[96 + k * 48 + i * 4..96 + k * 48 + i * 4 + 4].copy_from_slice(&q[k * 4..k * 4 + 4]); }
        }
        let (tinte, tc, dia) = match &self.cielo { Some(ci) => (ci.tinte, if ci.cubo != 0 && self.cubo.is_some() { 2.0 } else { 1.0 }, ci.dia), None => ([1.0; 3], 0.0, 0.0) };
        g[240..244].copy_from_slice(&[tinte[0], tinte[1], tinte[2], tc]); g[244..248].copy_from_slice(&[dia, 0.0, 0.0, 0.0]);
        g[248..264].copy_from_slice(&self.svp2); g[264..268].copy_from_slice(&[self.sesgo2[0], self.sesgo2[1], 0.0, 0.0]);
        // (para rehacer el mundo desde la profundidad sin la inversa: los rayos de la cámara y lo que pasa de la profundidad a la distancia)
        { let (ojo, r0, rx, ry, zl) = crate::gpu::rayos(vp); g[268..272].copy_from_slice(&[r0[0], r0[1], r0[2], zl[0]]); g[272..276].copy_from_slice(&[rx[0], rx[1], rx[2], zl[1]]); g[276..280].copy_from_slice(&[ry[0], ry[1], ry[2], 0.0]); g[280..284].copy_from_slice(&[ojo[0], ojo[1], ojo[2], 0.0]); }
    }
    fn clave_mat(&self, it: &ItemDin) -> (ClaveMat, f32) {
        let mt = &self.mats[&it.mat]; let m = &self.mallas[&it.m];
        let tx = |i: i64| if self.texs.contains_key(&i) { i } else { i64::MIN };
        let lm = if self.lms.contains_key(&m.lm_id) { m.lm_id } else { i64::MIN };
        let mut modo = (lm != i64::MIN) as i32 | if mt.cut != 0 { 2 } else { 0 } | if mt.unlit != 0 { 4 } else { 0 } | if mt.cut != 0 || mt.blend != 0 { 32 } else { 0 } | if mt.fol != 0 { 64 } else { 0 };
        let (mut t1, mut t2, mut t3) = (i64::MIN, i64::MIN, i64::MIN);
        if let Some(tr) = mt.terr.as_ref().filter(|t| t.len() == 3) { t1 = tx(tr[0].0); t2 = tx(tr[1].0); t3 = tx(tr[2].0); modo |= 16; }
        else if mt.t2 >= 0 { t1 = tx(mt.t2); modo |= 8; }
        ([tx(mt.t), t1, t2, t3, lm], modo as f32)
    }
    fn reg_obj(&self, a: &mut Arm, it: &ItemDin, sombra: bool) -> u32 {
        let k = (it.m, if sombra { i64::MIN } else { it.mat }, 0);
        if let Some(&o) = a.porobj.get(&k) { return o; }
        let m = &self.mallas[&it.m]; let o = (a.obj.len() / 64) as u32 * O_PASO as u32;
        let mut r = [0f32; 64];
        r[0..3].copy_from_slice(&m.mn); r[4..7].copy_from_slice(&m.sc);
        if !sombra {
            let mt = &self.mats[&it.mat]; let (_, modo) = self.clave_mat(it);
            r[8..12].copy_from_slice(&mt.st); r[12..16].copy_from_slice(&mt.c); r[16..19].copy_from_slice(&mt.em); r[20..23].copy_from_slice(&mt.pbr); r[32..44].copy_from_slice(&mt.ti);
            if let Some(tr) = mt.terr.as_ref().filter(|t| t.len() == 3) { r[24..28].copy_from_slice(&[tr[0].1, tr[0].2, tr[1].1, tr[1].2]); r[28] = tr[2].1; r[29] = tr[2].2; }
            r[30] = modo;
        }
        a.obj.extend_from_slice(&r); a.porobj.insert(k, o); o
    }
    fn reg_hue(a: &mut Arm, h: &[f32]) -> u32 {
        let n = h.len().min(MAX_HUESOS * 12);
        let mut x: u64 = 0xcbf29ce484222325; for v in &h[..n] { x = (x ^ v.to_bits() as u64).wrapping_mul(0x100000001b3); }
        if let Some(&o) = a.porhue.get(&x) { return o; }
        let o = (a.hue.len() * 4) as u32; let paso = (H_PASO / 4) as usize;
        let ini = a.hue.len(); a.hue.resize(ini + paso, 0.0); a.hue[ini..ini + n].copy_from_slice(&h[..n]);
        a.porhue.insert(x, o); o
    }
    fn lista(&self, a: &mut Arm, lista: &[usize], sombra: bool) -> Vec<Dib> {
        let mismo = |x: &ItemDin, y: &ItemDin| x.m == y.m && x.s0 == y.s0 && x.sn == y.sn && (sombra || x.mat == y.mat) && x.h.is_empty() && y.h.is_empty();
        let mut v = vec![]; let mut k = 0;
        while k < lista.len() {
            let it = &self.items[lista[k]]; let mut e = k + 1;
            while e < lista.len() && mismo(it, &self.items[lista[e]]) { e += 1; }
            let piel = !it.h.is_empty() && self.mallas[&it.m].piel.is_some();
            let inst = (a.inst.len() * 4) as u64;
            for &i in &lista[k..e] { a.inst.extend_from_slice(&self.items[i].mm); }
            let obj = self.reg_obj(a, it, sombra);
            let hue = if piel { Some(Self::reg_hue(a, &it.h)) } else { None };
            let mk = if sombra { [i64::MIN; 5] } else { let (mk, _) = self.clave_mat(it); a.claves.push(mk); mk };
            let corte = !sombra && self.mats.get(&it.mat).map_or(true, |mt| mt.cut != 0);
            let lejos = self.c.as_ref().map_or(0.0, |c| { let q = it.esf; ((q[0] - c.pos[0]).powi(2) + (q[1] - c.pos[1]).powi(2) + (q[2] - c.pos[2]).powi(2)).sqrt() - q[3] });
            v.push(Dib { m: it.m, s0: it.s0, sn: it.sn, obj, inst, n: (e - k) as u32, hue, mk, mezcla: 0, piel, corte, lejos });
            k = e;
        }
        v
    }
    fn recortar(&self, vp: &M4, sombra: bool) -> Vec<usize> {
        let pl = mat::planos(vp);
        let mut v: Vec<usize> = self.items.iter().enumerate().filter(|(_, it)| {
            let (Some(_), Some(mt)) = (self.mallas.get(&it.m), self.mats.get(&it.mat)) else { return false };
            mt.agua == 0 && mt.blend == 0 && mt.add == 0 && !(sombra && it.fl & FL_SIN_SOMBRA != 0) && mat::esfera_dentro(&pl, &it.esf)
        }).map(|(i, _)| i).collect();
        v.sort_by_key(|&i| { let it = &self.items[i]; (!it.h.is_empty() && self.mallas[&it.m].piel.is_some(), self.mats[&it.mat].t, it.m, it.s0, it.mat) });
        v
    }
    fn tex_v(&self, id: i64) -> vk::ImageView { if id == i64::MIN { self.blanca.v } else { self.texs.get(&id).map(|t| t.v).unwrap_or(self.blanca.v) } }
    unsafe fn grupos_mat(&mut self, claves: &[ClaveMat]) -> Result<(), String> {
        for k in claves {
            if self.g_mat.contains_key(k) { continue; }
            let lm = if k[4] == i64::MIN { self.blanca.v } else { self.lms.get(&k[4]).map(|t| t.v).unwrap_or(self.blanca.v) };
            let lays = [self.capas.mat];
            let g = ve(self.dev.allocate_descriptor_sets(&vk::DescriptorSetAllocateInfo::default().descriptor_pool(self.pool_mat).set_layouts(&lays)), "grupo de material")?[0];
            let vistas = [self.tex_v(k[0]), self.tex_v(k[1]), self.tex_v(k[2]), self.tex_v(k[3]), lm];
            let ii: Vec<[vk::DescriptorImageInfo; 1]> = vistas.iter().map(|&v| [vk::DescriptorImageInfo { sampler: vk::Sampler::null(), image_view: v, image_layout: vk::ImageLayout::SHADER_READ_ONLY_OPTIMAL }]).collect();
            let sr = [vk::DescriptorImageInfo { sampler: self.s_rep, image_view: vk::ImageView::null(), image_layout: vk::ImageLayout::UNDEFINED }];
            let sc = [vk::DescriptorImageInfo { sampler: self.s_cla, image_view: vk::ImageView::null(), image_layout: vk::ImageLayout::UNDEFINED }];
            let mut w: Vec<vk::WriteDescriptorSet> = ii.iter().enumerate().map(|(n, i)| vk::WriteDescriptorSet::default().dst_set(g).dst_binding(n as u32).descriptor_type(vk::DescriptorType::SAMPLED_IMAGE).image_info(i)).collect();
            w.push(vk::WriteDescriptorSet::default().dst_set(g).dst_binding(5).descriptor_type(vk::DescriptorType::SAMPLER).image_info(&sr));
            w.push(vk::WriteDescriptorSet::default().dst_set(g).dst_binding(6).descriptor_type(vk::DescriptorType::SAMPLER).image_info(&sc));
            self.dev.update_descriptor_sets(&w, &[]);
            self.g_mat.insert(*k, g);
        }
        Ok(())
    }

    /// los destinos de este tamaño (la escena, su profundidad y la oclusión a media resolución) y la sombra
    unsafe fn destinos(&mut self, w: u32, h: u32) -> Result<(), String> {
        let ao_ok = self.dest.as_ref().map(|d| d.ao.is_some() == self.op.ao).unwrap_or(false);
        let con_agua = self.agua.is_some() && self.agua_n.is_some();
        // (el reflejo: el del agua o, en Definitivo, el del piso)
        let con_refl = con_agua || (self.op.aaa && self.op.reflejo);
        let agua_ok = self.dest.as_ref().map(|d| d.refr.is_some() == con_agua && d.refl.is_some() == con_refl).unwrap_or(false);
        if self.dest.as_ref().map(|d| d.w != w || d.h != h).unwrap_or(true) || !ao_ok || !agua_ok {
            let _ = self.dev.device_wait_idle();
            if let Some(d) = self.dest.take() { self.soltar_dest(d); }
            use vk::ImageUsageFlags as U;
            let color = self.img(w, h, FMT, U::COLOR_ATTACHMENT | U::SAMPLED | U::TRANSFER_SRC, vk::ImageAspectFlags::COLOR, 1, 1)?;
            let prof = self.img(w, h, self.fmt_p, U::DEPTH_STENCIL_ATTACHMENT | U::SAMPLED, vk::ImageAspectFlags::DEPTH, 1, 1)?;
            let at = [color.v, prof.v];
            let fb_esc = ve(self.dev.create_framebuffer(&vk::FramebufferCreateInfo::default().render_pass(self.pasadas.esc_ao).attachments(&at).width(w).height(h).layers(1), None), "fb")?;
            let ao = if self.op.ao {
                let (aw, ah) = ((w / 2).max(8), (h / 2).max(8));
                let a = self.img(aw, ah, FMT, U::COLOR_ATTACHMENT | U::SAMPLED, vk::ImageAspectFlags::COLOR, 1, 1)?; let at = [a.v];
                let fb = ve(self.dev.create_framebuffer(&vk::FramebufferCreateInfo::default().render_pass(self.pasadas.ao).attachments(&at).width(aw).height(ah).layers(1), None), "fb")?;
                Some((a, fb))
            } else { None };
            let refr = if con_agua { Some(self.img(w, h, FMT, U::SAMPLED | U::TRANSFER_DST, vk::ImageAspectFlags::COLOR, 1, 1)?) } else { None };
            let refl = if con_refl {
                let (rw, rh) = ((w / self.op.reflejo_div.max(1) as u32).max(16), (h / self.op.reflejo_div.max(1) as u32).max(16));
                let rc = self.img(rw, rh, FMT, U::COLOR_ATTACHMENT | U::SAMPLED, vk::ImageAspectFlags::COLOR, 1, 1)?;
                let rp = self.img(rw, rh, self.fmt_p, U::DEPTH_STENCIL_ATTACHMENT, vk::ImageAspectFlags::DEPTH, 1, 1)?;
                let at = [rc.v, rp.v];
                let fb = ve(self.dev.create_framebuffer(&vk::FramebufferCreateInfo::default().render_pass(self.pasadas.refl).attachments(&at).width(rw).height(rh).layers(1), None), "fb")?;
                // (el reflejo, listo para leer aunque este cuadro no se dibuje —la cámara abajo del agua—)
                let ri = rc.i; self.una_vez(|d, cb| barrera(d, cb, ri, vk::ImageAspectFlags::COLOR, vk::ImageLayout::UNDEFINED, vk::ImageLayout::SHADER_READ_ONLY_OPTIMAL, 0, 1, 1))?;
                Some((rc, rp, fb))
            } else { None };
            self.dest = Some(Destinos { w, h, color, prof, fb_esc, ao, refr, refl });
        }
        let px = self.op.sombra_px;
        if self.op.sombras && self.sombra.as_ref().map(|s| s.2 != px).unwrap_or(true) {
            let _ = self.dev.device_wait_idle();
            if let Some((i, f, _)) = self.sombra.take() { self.dev.destroy_framebuffer(f, None); self.soltar_img(&i); }
            let i = self.img(px as u32 * 2, px as u32, self.fmt_s, vk::ImageUsageFlags::DEPTH_STENCIL_ATTACHMENT | vk::ImageUsageFlags::SAMPLED, vk::ImageAspectFlags::DEPTH, 1, 1)?;
            let at = [i.v];
            let f = ve(self.dev.create_framebuffer(&vk::FramebufferCreateInfo::default().render_pass(self.pasadas.sombra).attachments(&at).width(px as u32 * 2).height(px as u32).layers(1), None), "fb")?;
            // (lista para leer aunque todavía no se haya dibujado)
            let ii = i.i; self.una_vez(|d, cb| barrera(d, cb, ii, vk::ImageAspectFlags::DEPTH, vk::ImageLayout::UNDEFINED, vk::ImageLayout::DEPTH_STENCIL_READ_ONLY_OPTIMAL, 0, 1, 1))?;
            self.sombra = Some((i, f, px)); self.sombra_huella = [0; 2];
        }
        Ok(())
    }
    unsafe fn soltar_dest(&self, d: Destinos) {
        self.dev.destroy_framebuffer(d.fb_esc, None); self.soltar_img(&d.color); self.soltar_img(&d.prof);
        if let Some((a, f)) = d.ao { self.dev.destroy_framebuffer(f, None); self.soltar_img(&a); }
        if let Some(rf) = d.refr { self.soltar_img(&rf); }
        if let Some((c, p, f)) = d.refl { self.dev.destroy_framebuffer(f, None); self.soltar_img(&c); self.soltar_img(&p); }
    }

    /// un cuadro entero: las pasadas, la imagen final y el HUD (`ui`: tandas de vértices de 8 floats, cada una con su
    /// textura), y a la pantalla. Devuelve si hubo que rehacer la cadena (la pantalla giró o cambió de tamaño)
    pub unsafe fn dibujar(&mut self, tandas: &[(i64, &[f32])]) -> Result<bool, String> {
        let ui: Vec<f32> = tandas.iter().flat_map(|t| t.1.iter().copied()).collect();
        if self.rehacer { let _ = self.dev.device_wait_idle(); self.hacer_cadena()?; }
        let mi = self.marco;
        let listo = self.marcos[mi].listo;
        ve(self.dev.wait_for_fences(&[listo], true, u64::MAX), "espera")?;
        self.leer_tiempos(mi);
        self.oclu_leer(mi);
        // (la imagen de la pantalla)
        let (img_i, fb_fin, ext, giro) = if let Some(c) = &self.cadena {
            match self.sc_d.as_ref().unwrap().acquire_next_image(c.sc, u64::MAX, self.marcos[mi].sem_img, vk::Fence::null()) {
                Ok((i, sub)) => { if sub { self.rehacer = true; } (i, c.fbs[i as usize], c.ext, c.giro) }
                Err(vk::Result::ERROR_OUT_OF_DATE_KHR) => { self.rehacer = true; return Ok(true); }
                Err(e) => return Err(format!("acquire: {e:?}")),
            }
        } else { let p = self.propia.as_ref().unwrap(); (0, p.fb, vk::Extent2D { width: p.img.w, height: p.img.h }, 0) };
        // (la escena se dibuja a la escala elegida —la resolución de Ajustes— y la pasada final la estira a la pantalla)
        let (w, h) = { let (tw, th) = self.tam(); let e = self.op.escala.clamp(0.1, 1.0); (((tw as f32 * e).round() as u32).max(16), ((th as f32 * e).round() as u32).max(16)) };
        self.destinos(w, h)?;
        ve(self.dev.reset_fences(&[listo]), "valla")?;
        let cb = self.marcos[mi].cb;
        ve(self.dev.reset_command_buffer(cb, vk::CommandBufferResetFlags::empty()), "reset")?;
        ve(self.dev.reset_descriptor_pool(self.marcos[mi].pool, vk::DescriptorPoolResetFlags::empty()), "pool")?;
        ve(self.dev.begin_command_buffer(cb, &vk::CommandBufferBeginInfo::default().flags(vk::CommandBufferUsageFlags::ONE_TIME_SUBMIT)), "begin")?;
        let medir = self.marcos[mi].q.is_some() && self.cuadro % 30 == 0;
        if medir { self.dev.cmd_reset_query_pool(cb, self.marcos[mi].q.unwrap(), 0, NTIEMPOS); }
        self.dev.cmd_reset_query_pool(cb, self.marcos[mi].oq, 0, OCLU_MAX);
        self.marcos[mi].nombres.clear();
        let hay_cuadro = self.c.is_some();
        if hay_cuadro { self.grabar(cb, mi, w, h, medir)?; }
        // --- a la pantalla: la escena estirada con el retoque, girada si hace falta, y el HUD
        let (cs, sn) = match giro { 90 => (0.0, -1.0), 180 => (-1.0, 0.0), 270 => (0.0, 1.0), _ => (1.0, 0.0) };
        let srgb = matches!(self.tubos.fmt_fin, vk::Format::R8G8B8A8_SRGB | vk::Format::B8G8R8A8_SRGB);
        let mut post = vec![0f32; (U_PASO / 4 * 2) as usize];
        let (aw, ah) = self.dest.as_ref().and_then(|d| d.ao.as_ref()).map(|(a, _)| (a.w, a.h)).unwrap_or((1, 1));
        post[0..4].copy_from_slice(&[0.75 / aw as f32, 0.75 / ah as f32, self.op.ao_fuerza, 0.0]);
        post[64..72].copy_from_slice(&[if self.op.retoque { 1.0 } else { 0.0 }, if srgb { 1.0 } else { 0.0 }, 0.0, 0.0, cs, sn, 0.0, 0.0]);
        let uiu = { let (tw, th) = self.tam(); [1.0 / tw as f32, 1.0 / th as f32, 0.0, 0.0, cs, sn, 0.0, 0.0] };
        self.escribir(mi, 4, f32b(&post))?; self.escribir(mi, 6, f32b(&uiu))?; self.escribir(mi, 5, f32b(&ui))?;
        let fin_t = self.marcar(cb, mi, medir, "final", true);
        let lim = [vk::ClearValue { color: vk::ClearColorValue { float32: [0.06, 0.07, 0.09, 1.0] } }];
        self.dev.cmd_begin_render_pass(cb, &vk::RenderPassBeginInfo::default().render_pass(if self.cadena.is_some() { self.pasadas.fin } else { self.pasadas.fin_propia }).framebuffer(fb_fin)
            .render_area(vk::Rect2D { offset: vk::Offset2D::default(), extent: ext }).clear_values(&lim), vk::SubpassContents::INLINE);
        vista(&self.dev, cb, ext.width, ext.height, 0.0);
        if hay_cuadro {
            let cv = self.dest.as_ref().unwrap().color.v;
            let g = self.grupo_tex1(mi, cv, self.s_cla, 4)?;
            self.dev.cmd_bind_pipeline(cb, vk::PipelineBindPoint::GRAPHICS, self.tubos.fin);
            self.dev.cmd_bind_descriptor_sets(cb, vk::PipelineBindPoint::GRAPHICS, self.planos.tex1, 0, &[g], &[U_PASO as u32]);
            self.dev.cmd_draw(cb, 3, 1, 0, 0);
        }
        if ui.len() >= 8 {
            self.dev.cmd_bind_pipeline(cb, vk::PipelineBindPoint::GRAPHICS, self.tubos.ui);
            self.dev.cmd_bind_vertex_buffers(cb, 0, &[self.marcos[mi].ui.b], &[0]);
            let mut desde = 0u32;
            for (tex, v) in tandas {
                let n = (v.len() / 8) as u32; if n == 0 { continue; }
                let tv = self.texs.get(tex).map(|t| t.v).unwrap_or(self.blanca.v);
                let g = self.grupo_tex1(mi, tv, self.s_rep, 6)?;
                self.dev.cmd_bind_descriptor_sets(cb, vk::PipelineBindPoint::GRAPHICS, self.planos.tex1, 0, &[g], &[0]);
                self.dev.cmd_draw(cb, n, 1, desde, 0); desde += n;
            }
        }
        self.dev.cmd_end_render_pass(cb);
        if let Some(t) = fin_t { self.marcar_fin(cb, mi, t); }
        // (sin ventana: la imagen a un búfer que se puede leer)
        if let Some(p) = &self.propia {
            self.dev.cmd_copy_image_to_buffer(cb, p.img.i, vk::ImageLayout::TRANSFER_SRC_OPTIMAL, p.leer.b, &[vk::BufferImageCopy { buffer_offset: 0, buffer_row_length: 0, buffer_image_height: 0,
                image_subresource: vk::ImageSubresourceLayers { aspect_mask: vk::ImageAspectFlags::COLOR, mip_level: 0, base_array_layer: 0, layer_count: 1 }, image_offset: vk::Offset3D::default(), image_extent: vk::Extent3D { width: p.img.w, height: p.img.h, depth: 1 } }]);
            let mb = [vk::MemoryBarrier::default().src_access_mask(vk::AccessFlags::TRANSFER_WRITE).dst_access_mask(vk::AccessFlags::HOST_READ)];
            self.dev.cmd_pipeline_barrier(cb, vk::PipelineStageFlags::TRANSFER, vk::PipelineStageFlags::HOST, vk::DependencyFlags::empty(), &mb, &[], &[]);
        }
        ve(self.dev.end_command_buffer(cb), "end")?;
        let cbs = [cb];
        let (esperar, senal): (Vec<vk::Semaphore>, Vec<vk::Semaphore>) = match &self.cadena { Some(c) => (vec![self.marcos[mi].sem_img], vec![c.sems[img_i as usize]]), None => (vec![], vec![]) };
        let etapas = [vk::PipelineStageFlags::COLOR_ATTACHMENT_OUTPUT];
        let si = vk::SubmitInfo::default().command_buffers(&cbs).wait_semaphores(&esperar).wait_dst_stage_mask(&etapas[..esperar.len()]).signal_semaphores(&senal);
        ve(self.dev.queue_submit(self.q, &[si], listo), "submit")?;
        self.marcos[mi].usado = true;
        if let Some(c) = &self.cadena {
            let scs = [c.sc]; let idx = [img_i];
            match self.sc_d.as_ref().unwrap().queue_present(self.q, &vk::PresentInfoKHR::default().wait_semaphores(&senal).swapchains(&scs).image_indices(&idx)) {
                Ok(sub) => { if sub { self.rehacer = true; } }
                Err(vk::Result::ERROR_OUT_OF_DATE_KHR) => { self.rehacer = true; }
                Err(e) => return Err(format!("present: {e:?}")),
            }
        }
        self.marco = (self.marco + 1) % MARCOS;
        self.cuadro += 1;
        Ok(self.rehacer)
    }

    /// escribe bytes en uno de los búferes del cuadro (0 glob, 1 obj, 2 huesos, 3 matrices, 4 post, 5 HUD, 6 HUD uniforme,
    /// 7 partículas, 8 lo de cada bloque de partículas, 9 marcas), agrandándolo si no entran (el cuadro ya terminó: se puede rehacer)
    unsafe fn escribir(&mut self, mi: usize, k: u8, datos: &[u8]) -> Result<(), String> {
        let n = datos.len() as u64;
        let tam = { let m = &self.marcos[mi]; match k { 0 => m.glob.tam, 1 => m.obj.tam, 2 => m.hue.tam, 3 => m.inst.tam, 4 => m.post.tam, 5 => m.ui.tam, 7 => m.part.tam, 8 => m.partu.tam, 9 => m.marcas.tam, _ => m.uiu.tam } };
        if n > tam {
            let uso = if matches!(k, 3 | 5 | 7 | 9) { vk::BufferUsageFlags::VERTEX_BUFFER } else { vk::BufferUsageFlags::UNIFORM_BUFFER };
            let nb = self.buf((n * 3 / 2 + 4095) & !4095, uso, vk::MemoryPropertyFlags::HOST_VISIBLE | vk::MemoryPropertyFlags::HOST_COHERENT)?;
            let m = &mut self.marcos[mi];
            let viejo = std::mem::replace(match k { 0 => &mut m.glob, 1 => &mut m.obj, 2 => &mut m.hue, 3 => &mut m.inst, 4 => &mut m.post, 5 => &mut m.ui, 7 => &mut m.part, 8 => &mut m.partu, 9 => &mut m.marcas, _ => &mut m.uiu }, nb);
            self.soltar_buf(&viejo);
        }
        let m = &self.marcos[mi];
        let b = match k { 0 => &m.glob, 1 => &m.obj, 2 => &m.hue, 3 => &m.inst, 4 => &m.post, 5 => &m.ui, 7 => &m.part, 8 => &m.partu, 9 => &m.marcas, _ => &m.uiu };
        if n > 0 { std::ptr::copy_nonoverlapping(datos.as_ptr(), b.ptr, datos.len()); }
        Ok(())
    }
    unsafe fn grupo(&self, mi: usize, capa: vk::DescriptorSetLayout) -> Result<vk::DescriptorSet, String> {
        let l = [capa]; Ok(ve(self.dev.allocate_descriptor_sets(&vk::DescriptorSetAllocateInfo::default().descriptor_pool(self.marcos[mi].pool).set_layouts(&l)), "grupo")?[0])
    }
    unsafe fn grupo_unif(&self, mi: usize, capa: vk::DescriptorSetLayout, b: vk::Buffer, tam: u64) -> Result<vk::DescriptorSet, String> {
        let g = self.grupo(mi, capa)?; let bi = [vk::DescriptorBufferInfo { buffer: b, offset: 0, range: tam }];
        self.dev.update_descriptor_sets(&[vk::WriteDescriptorSet::default().dst_set(g).dst_binding(0).descriptor_type(vk::DescriptorType::UNIFORM_BUFFER_DYNAMIC).buffer_info(&bi)], &[]);
        Ok(g)
    }
    /// un grupo de textura, muestreador y registro (la imagen final, poner la oclusión y el HUD): k es el búfer del cuadro
    unsafe fn grupo_tex1(&self, mi: usize, v: vk::ImageView, s: vk::Sampler, k: u8) -> Result<vk::DescriptorSet, String> {
        let m = &self.marcos[mi];
        self.grupo_tex_buf(mi, v, s, match k { 6 => m.uiu.b, 8 => m.partu.b, _ => m.post.b })
    }
    unsafe fn grupo_tex_buf(&self, mi: usize, v: vk::ImageView, s: vk::Sampler, b: vk::Buffer) -> Result<vk::DescriptorSet, String> {
        let g = self.grupo(mi, self.capas.tex1)?;
        let ii = [vk::DescriptorImageInfo { sampler: vk::Sampler::null(), image_view: v, image_layout: vk::ImageLayout::SHADER_READ_ONLY_OPTIMAL }];
        let si = [vk::DescriptorImageInfo { sampler: s, image_view: vk::ImageView::null(), image_layout: vk::ImageLayout::UNDEFINED }];
        let bi = [vk::DescriptorBufferInfo { buffer: b, offset: 0, range: U_TAM }];
        self.dev.update_descriptor_sets(&[
            vk::WriteDescriptorSet::default().dst_set(g).dst_binding(0).descriptor_type(vk::DescriptorType::SAMPLED_IMAGE).image_info(&ii),
            vk::WriteDescriptorSet::default().dst_set(g).dst_binding(1).descriptor_type(vk::DescriptorType::SAMPLER).image_info(&si),
            vk::WriteDescriptorSet::default().dst_set(g).dst_binding(2).descriptor_type(vk::DescriptorType::UNIFORM_BUFFER_DYNAMIC).buffer_info(&bi)], &[]);
        Ok(g)
    }

    /// las pasadas de la escena (todo menos la imagen final)
    unsafe fn grabar(&mut self, cb: vk::CommandBuffer, mi: usize, w: u32, h: u32, medir: bool) -> Result<(), String> {
        let mut hacer_sombra = self.op.sombras && self.sombra.is_some() && (self.cuadro % self.op.sombra_cada.max(1) as u64 == 0 || self.cuadro < 2);
        let vp = self.c.as_ref().unwrap().vp;
        if hacer_sombra {
            let c = self.c.as_ref().unwrap(); let s = self.sol();
            let (a, sa) = crate::gpu::cascada(c, s, &self.op, 0); let (b, sb) = crate::gpu::cascada(c, s, &self.op, 1);
            self.svp = a; self.sesgo = sa; self.svp2 = b; self.sesgo2 = sb;
        }
        let mut a = Arm::default();
        // (cada cascada se rehace sólo si cambió su huella: con todo quieto, la sombra de antes sirve tal cual)
        let (mut l_s0, mut l_s1) = (vec![], vec![]); let mut mitades = [false; 2];
        if hacer_sombra {
            let (x, y) = (self.recortar(&self.svp.clone(), true), self.recortar(&self.svp2.clone(), true));
            let hs = [self.huella(&self.svp, &x), self.huella(&self.svp2, &y)];
            mitades = [hs[0] != self.sombra_huella[0], hs[1] != self.sombra_huella[1]]; self.sombra_huella = hs;
            if mitades[0] { l_s0 = self.lista(&mut a, &x, true); }
            if mitades[1] { l_s1 = self.lista(&mut a, &y, true); }
            hacer_sombra = mitades[0] || mitades[1];
        }
        // (el agua: si hay, se ve desde arriba y la placa tiene su reflejo)
        let ay = self.c.as_ref().unwrap().agua_y.or(self.agua.as_ref().map(|a| a.y));
        let (ew, eh) = (w, h);
        let hay_agua = !self.aguas.is_empty() && self.agua.is_some() && self.agua_n.is_some() && self.dest.as_ref().map(|d| d.refr.is_some()).unwrap_or(false);
        let cam_arriba = ay.map(|y| self.c.as_ref().unwrap().pos[1] > y + 0.05).unwrap_or(false);
        // (Definitivo: el reflejo del piso de abajo de la cámara —como OpenGL 3—, si a la vista y cerca hay algo que lo cruza; el
        // agua a la vista pero lejos —la pileta por la ventana— con un piso que no es la orilla no se lo quita)
        let piso = if self.op.aaa && self.op.reflejo && self.dest.as_ref().map_or(false, |d| d.refl.is_some()) { self.piso_reflejo() } else { None };
        let cp = self.c.as_ref().unwrap().pos;
        let agua_lejos = piso.map_or(false, |y| ay.map_or(true, |a| y > a + 0.3)) && self.aguas.iter().all(|&i| { let e = self.items[i].esf; ((e[0] - cp[0]).powi(2) + (e[2] - cp[2]).powi(2)).sqrt() - e[3] > 10.0 });
        let hacer_ref = hay_agua && self.op.reflejo && cam_arriba && !agua_lejos;
        let hacer_piso = !hacer_ref && piso.is_some(); self.refl_piso = piso.filter(|_| hacer_piso);
        let plano = if hacer_ref { ay } else if hacer_piso { piso } else { None };
        // (el corte: del agua, lo de arriba; del piso, lo de arriba del piso —el piso mismo no se refleja—)
        let corte = plano.map(|y| if hacer_piso { y + 0.03 } else { y - 0.05 }).unwrap_or(-1e9);
        let vref = plano.map(|y| mat::mul(&vp, &mat::espejo_y(y))).unwrap_or(vp);
        // (en el reflejo sólo lo que cruza el agua necesita el corte —el sombreador que descarta—; lo que está entero arriba va
        // con el que no descarta, así se prueba la profundidad antes de pintar)
        // (y sólo donde está el agua en la pantalla —más lo que la corren las olas—: ese rectángulo y lo que puede caer adentro)
        let (r0, r1) = if hacer_piso { ([-1.0, -1.0], [1.0, 1.0]) } else { crate::gpu::rect_agua(&vp, self.aguas.iter().map(|&i| self.items[i].esf)) };
        let (l_ref, l_ref_c) = if hacer_ref || hacer_piso {
            let pl = crate::gpu::planos_rect(&vref, r0, r1); let lejos = if hacer_piso { 110.0 } else { 1e9 };
            let (arr, cru): (Vec<usize>, Vec<usize>) = self.recortar(&vref, false).into_iter().filter(|&i| { let e = self.items[i].esf; e[1] + e[3] > corte && mat::esfera_dentro(&pl, &e)
                && ((e[0] - cp[0]).powi(2) + (e[2] - cp[2]).powi(2)).sqrt() - e[3] < lejos }).partition(|&i| { let e = self.items[i].esf; e[1] - e[3] > corte + 0.05 });
            (self.lista(&mut a, &arr, false), self.lista(&mut a, &cru, false))
        } else { (vec![], vec![]) };
        // (el cielo 3D —la maqueta de los mapas del Workshop— aparte: se dibuja primero y después se borra la profundidad)
        let (op_c, opacos): (Vec<usize>, Vec<usize>) = self.opacos.iter().partition(|&&i| self.items[i].fl & FL_CIELO != 0);
        let l_cie = self.lista(&mut a, &op_c, false);
        // (la oclusión: lo que la última prueba de su caja dio tapado del todo no va —ni a la profundidad ni a la luz—; las cajas
        // de este cuadro se prueban después de la pasada de profundidad y se leen cuando este cuadro en vuelo vuelve)
        let con_oclu = self.op.prepaso && std::env::var_os("JXM_VK_SIN_OCLU").is_none();
        let mut pruebas: Vec<(u32, u64)> = vec![]; let mut inst_id = 0u64;
        let opacos: Vec<usize> = if con_oclu {
            let vpc = vp; let fy = (vpc[1] * vpc[1] + vpc[5] * vpc[5] + vpc[9] * vpc[9]).sqrt();
            let mut quedan = vec![];
            for &i in &opacos {
                let Some(k) = self.oclu_clave(i) else { quedan.push(i); continue };
                let e = self.items[i].esf; let ent = self.oclu.get(&k).copied();
                let visto = ent.map_or(true, |x| x.0);
                if visto { quedan.push(i); }
                // (lo que se ve se vuelve a probar cada 4 cuadros —cada una en su turno—; lo tapado, siempre; lo que ocupa más de un
                // tercio de la pantalla se da por visto)
                if visto && ent.is_some() && (self.cuadro + (k & 3)) % 4 != 0 { continue; }
                let w = vpc[3] * e[0] + vpc[7] * e[1] + vpc[11] * e[2] + vpc[15];
                if w <= 0.0 || e[3] * fy / w > 0.33 { self.oclu.insert(k, (true, self.cuadro)); continue; }
                if pruebas.len() as u32 >= OCLU_MAX { continue; }
                let r = e[3] * 1.02 + 0.02; let o = (a.obj.len() / 64) as u32 * O_PASO as u32; let mut q = [0f32; 64];
                q[0..3].copy_from_slice(&[e[0] - r, e[1] - r, e[2] - r]); q[4..7].copy_from_slice(&[2.0 * r, 2.0 * r, 2.0 * r]);
                a.obj.extend_from_slice(&q); pruebas.push((o, k));
            }
            if !pruebas.is_empty() { inst_id = (a.inst.len() * 4) as u64; a.inst.extend_from_slice(&mat::id()); }
            quedan
        } else { opacos };
        let l_op = self.lista(&mut a, &opacos, false);
        let (mut l_tr, mut l_tr_c) = (vec![], vec![]);
        for &i in &self.transp.clone() {
            let it = &self.items[i]; let piel = !it.h.is_empty() && self.mallas[&it.m].piel.is_some();
            let inst = (a.inst.len() * 4) as u64; a.inst.extend_from_slice(&it.mm);
            let obj = self.reg_obj(&mut a, it, false); let hue = if piel { Some(Self::reg_hue(&mut a, &it.h)) } else { None };
            let (mk, _) = self.clave_mat(it); a.claves.push(mk);
            let x = Dib { m: it.m, s0: it.s0, sn: it.sn, obj, inst, n: 1, hue, mk, mezcla: if self.mats[&it.mat].add != 0 { 2 } else { 1 }, piel, corte: true, lejos: 0.0 };
            if it.fl & FL_CIELO != 0 { l_tr_c.push(x); } else { l_tr.push(x); }
        }
        // (un registro propio por cosa de agua, con lo del agua del mapa —como wg.rs—)
        let mut l_agua = vec![];
        if hay_agua {
            let ag = self.agua.as_ref().unwrap(); let refl_on = hacer_ref;
            let (bx, bz, bw, bh, bd) = ag.prof.as_ref().map(|q| (q.x0, q.z0, 1.0 / q.w, 1.0 / q.h, q.d)).unwrap_or((0.0, 0.0, 0.0, 0.0, 20.0));
            let t = self.c.as_ref().unwrap().tiempo; let t = if t > 0.0 { t } else { self.cuadro as f32 / 60.0 };
            for &i in &self.aguas {
                let it = &self.items[i]; let m = &self.mallas[&it.m];
                let o = (a.obj.len() / 64) as u32 * O_PASO as u32; let mut r = [0f32; 64];
                r[0..3].copy_from_slice(&m.mn); r[4..7].copy_from_slice(&m.sc); r[8..12].copy_from_slice(&ag.fog);
                r[12..16].copy_from_slice(&[ag.esc, ag.fuerza, ag.dist, if refl_on { 1.0 } else { 0.0 }]); r[16..20].copy_from_slice(&ag.s);
                r[20..24].copy_from_slice(&[bx, bz, bw, bh]); r[24..28].copy_from_slice(&[bd, ag.largo.max(0.5), 1.0 / ew as f32, 1.0 / eh as f32]);
                r[28..32].copy_from_slice(&[if cam_arriba { 1.0 } else { 0.0 }, ag.refr, t, 0.0]);
                a.obj.extend_from_slice(&r);
                let inst = (a.inst.len() * 4) as u64; a.inst.extend_from_slice(&it.mm);
                l_agua.push(Dib { m: it.m, s0: it.s0, sn: it.sn, obj: o, inst, n: 1, hue: None, mk: [i64::MIN; 5], mezcla: 1, piel: false, corte: true, lejos: 0.0 });
            }
        }
        let n = (G_PASO / 4) as usize; let mut gb = vec![0f32; n * 4];
        self.glob(&vp, -1e9, &mut gb[0..n]);
        if plano.is_some() { self.glob(&vref, corte, &mut gb[n..2 * n]); }
        // (en la cámara: el reflejo del piso prendido, su altura y 1/ancho, 1/alto de la escena para leerlo)
        if let Some(y) = piso.filter(|_| hacer_piso) { gb[245] = 1.0; gb[246] = y; gb[266] = 1.0 / ew as f32; gb[267] = 1.0 / eh as f32; }
        if hacer_sombra { let (s0, s1) = (self.svp, self.svp2); self.glob(&s0, -1e9, &mut gb[2 * n..3 * n]); self.glob(&s1, -1e9, &mut gb[3 * n..4 * n]); }
        self.escribir(mi, 0, f32b(&gb))?; self.escribir(mi, 1, f32b(&a.obj))?; self.escribir(mi, 2, f32b(&a.hue))?; self.escribir(mi, 3, f32b(&a.inst))?;
        // (las partículas: los bloques del cuadro en su orden —las de alfa de lejos a cerca, las que suman, las trazas—, una fila
        // de 16 floats por instancia y, por bloque, la derecha y el arriba de la cámara en su lugar de 256 bytes; las marcas se
        // copian a este cuadro en vuelo sólo si cambiaron)
        let mut p_inst: Vec<f32> = vec![]; let mut p_u: Vec<f32> = vec![]; let mut p_dib: Vec<(usize, u32, u32)> = vec![];
        if let Some(c) = self.c.as_ref() {
            for (t, d) in c.efectos.iter().filter(|e| (e.0 == EF_PART_ALFA || e.0 == EF_PART_SUMA) && e.1.len() > 6) {
                let n = (d.len() - 6) / PART_F; if n == 0 { continue; }
                let desde = (p_inst.len() / PART_F) as u32; p_inst.extend_from_slice(&d[6..6 + n * PART_F]);
                let k = p_u.len(); p_u.resize(k + (U_PASO / 4) as usize, 0.0); p_u[k..k + 3].copy_from_slice(&d[0..3]); p_u[k + 4..k + 7].copy_from_slice(&d[3..6]);
                p_dib.push((if *t == EF_PART_SUMA { 1 } else { 0 }, desde, n as u32));
            }
        }
        if !p_dib.is_empty() { self.escribir(mi, 7, f32b(&p_inst))?; self.escribir(mi, 8, f32b(&p_u))?; }
        if self.marcos[mi].marcas_ver != self.marcas_ver {
            let mk = std::mem::take(&mut self.marcas); let r = self.escribir(mi, 9, f32b(&mk)); self.marcas = mk; r?;
            self.marcos[mi].marcas_ver = self.marcas_ver;
        }
        let n_marcas = (self.marcas.len() / MARCA_F) as u32;
        let claves = std::mem::take(&mut a.claves); self.grupos_mat(&claves)?;
        // (los grupos de este cuadro)
        let (mg, mo, mh) = { let m = &self.marcos[mi]; (m.glob.b, m.obj.b, m.hue.b) };
        let g_solo = self.grupo_unif(mi, self.capas.glob_solo, mg, G_TAM)?;
        let g_obj = self.grupo_unif(mi, self.capas.obj, mo, O_TAM)?;
        let g_hue = self.grupo_unif(mi, self.capas.hue, mh, H_TAM)?;
        let g_part = if p_dib.is_empty() { vk::DescriptorSet::null() } else {
            let av = self.texs.get(&crate::gpu::TEX_ATLAS).map(|t| t.v).unwrap_or(self.blanca.v);
            self.grupo_tex_buf(mi, av, self.s_rep, self.marcos[mi].partu.b)?
        };
        // (la cabecera con la sombra y el reflejo del piso; la del reflejo mismo, con la blanca en su lugar —no se lee lo que se
        // está dibujando—)
        let glob_con = |m: &Self, rv: vk::ImageView| -> Result<vk::DescriptorSet, String> {
            let g = m.grupo(mi, m.capas.glob)?;
            let sv = m.sombra.as_ref().map(|s| s.0.v).unwrap_or(m.prof0.v);
            let bi = [vk::DescriptorBufferInfo { buffer: mg, offset: 0, range: G_TAM }];
            let ii = [vk::DescriptorImageInfo { sampler: vk::Sampler::null(), image_view: sv, image_layout: vk::ImageLayout::DEPTH_STENCIL_READ_ONLY_OPTIMAL }];
            let si = [vk::DescriptorImageInfo { sampler: m.s_cmp, image_view: vk::ImageView::null(), image_layout: vk::ImageLayout::UNDEFINED }];
            let ri = [vk::DescriptorImageInfo { sampler: vk::Sampler::null(), image_view: rv, image_layout: vk::ImageLayout::SHADER_READ_ONLY_OPTIMAL }];
            m.dev.update_descriptor_sets(&[
                vk::WriteDescriptorSet::default().dst_set(g).dst_binding(0).descriptor_type(vk::DescriptorType::UNIFORM_BUFFER_DYNAMIC).buffer_info(&bi),
                vk::WriteDescriptorSet::default().dst_set(g).dst_binding(1).descriptor_type(vk::DescriptorType::SAMPLED_IMAGE).image_info(&ii),
                vk::WriteDescriptorSet::default().dst_set(g).dst_binding(2).descriptor_type(vk::DescriptorType::SAMPLER).image_info(&si),
                vk::WriteDescriptorSet::default().dst_set(g).dst_binding(3).descriptor_type(vk::DescriptorType::SAMPLED_IMAGE).image_info(&ri)], &[]);
            Ok(g)
        };
        let rv = if hacer_piso { self.dest.as_ref().and_then(|d| d.refl.as_ref()).map(|r| r.0.v).unwrap_or(self.blanca.v) } else { self.blanca.v };
        let g_glob = glob_con(self, rv)?;
        let g_glob_r = if plano.is_some() { glob_con(self, self.blanca.v)? } else { g_glob };
        let g_cielo = {
            let g = self.grupo(mi, self.capas.cielo)?;
            let ii = [vk::DescriptorImageInfo { sampler: vk::Sampler::null(), image_view: self.cubo.as_ref().map(|c| c.v).unwrap_or(self.cubo0.v), image_layout: vk::ImageLayout::SHADER_READ_ONLY_OPTIMAL }];
            let si = [vk::DescriptorImageInfo { sampler: self.s_cla, image_view: vk::ImageView::null(), image_layout: vk::ImageLayout::UNDEFINED }];
            self.dev.update_descriptor_sets(&[vk::WriteDescriptorSet::default().dst_set(g).dst_binding(0).descriptor_type(vk::DescriptorType::SAMPLED_IMAGE).image_info(&ii),
                vk::WriteDescriptorSet::default().dst_set(g).dst_binding(1).descriptor_type(vk::DescriptorType::SAMPLER).image_info(&si)], &[]);
            g
        };
        let d = self.dev.clone();
        let mut dibujos = 0u32;
        // --- la sombra: las dos cascadas, una al lado de la otra
        if hacer_sombra {
            let (_, fb, px) = { let s = self.sombra.as_ref().unwrap(); (s.0.i, s.1, s.2 as u32) };
            let t = self.marcar(cb, mi, medir, "sombra", true);
            let lim = [vk::ClearValue { depth_stencil: vk::ClearDepthStencilValue { depth: 1.0, stencil: 0 } }];
            let (rp, area) = match mitades { [true, true] => (self.pasadas.sombra, rect(px * 2, px)),
                [true, false] => (self.pasadas.sombra_parcial, rect(px, px)),
                _ => (self.pasadas.sombra_parcial, vk::Rect2D { offset: vk::Offset2D { x: px as i32, y: 0 }, extent: vk::Extent2D { width: px, height: px } }) };
            d.cmd_begin_render_pass(cb, &vk::RenderPassBeginInfo::default().render_pass(rp).framebuffer(fb).render_area(area).clear_values(&lim), vk::SubpassContents::INLINE);
            for (k, l) in [(0u64, &l_s0), (1, &l_s1)] {
                if !mitades[k as usize] { continue; }
                vista_en(&d, cb, (k as u32 * px) as f32, 0.0, px as f32, px as f32);
                d.cmd_bind_descriptor_sets(cb, vk::PipelineBindPoint::GRAPHICS, self.planos.sombra, 0, &[g_solo], &[((G_SOM + k) * G_PASO) as u32]);
                dibujos += self.dibujar_lista(cb, l, true, false, g_obj, g_hue);
            }
            d.cmd_end_render_pass(cb);
            if let Some(t) = t { self.marcar_fin(cb, mi, t); }
        }
        // --- el reflejo del agua: la escena espejada en el plano del agua, a una fracción de la resolución
        if plano.is_some() {
            let (fb, rw, rh) = { let r = self.dest.as_ref().unwrap().refl.as_ref().unwrap(); (r.2, r.0.w, r.0.h) };
            let t = self.marcar(cb, mi, medir, "reflejo", true);
            let lim = [vk::ClearValue { color: vk::ClearColorValue { float32: [0.0, 0.0, 0.0, 1.0] } }, vk::ClearValue { depth_stencil: vk::ClearDepthStencilValue { depth: 1.0, stencil: 0 } }];
            // (la Y de la pantalla de Vulkan va para abajo: el rectángulo del agua dado vuelta)
            let (x0, x1) = (((r0[0] * 0.5 + 0.5) * rw as f32).floor().max(0.0) as u32, ((r1[0] * 0.5 + 0.5) * rw as f32).ceil().min(rw as f32) as u32);
            let (y0, y1) = (((0.5 - r1[1] * 0.5) * rh as f32).floor().max(0.0) as u32, ((0.5 - r0[1] * 0.5) * rh as f32).ceil().min(rh as f32) as u32);
            let area = vk::Rect2D { offset: vk::Offset2D { x: x0 as i32, y: y0 as i32 }, extent: vk::Extent2D { width: (x1.max(x0 + 1) - x0), height: (y1.max(y0 + 1) - y0) } };
            d.cmd_begin_render_pass(cb, &vk::RenderPassBeginInfo::default().render_pass(self.pasadas.refl).framebuffer(fb).render_area(area).clear_values(&lim), vk::SubpassContents::INLINE);
            vista(&d, cb, rw, rh, 0.0); d.cmd_set_scissor(cb, 0, &[area]);
            d.cmd_bind_descriptor_sets(cb, vk::PipelineBindPoint::GRAPHICS, self.planos.luz, 0, &[g_glob_r], &[(G_REF * G_PASO) as u32]);
            dibujos += self.dibujar_lista(cb, &l_ref, false, true, g_obj, g_hue);
            dibujos += self.dibujar_lista(cb, &l_ref_c, false, false, g_obj, g_hue);
            d.cmd_bind_pipeline(cb, vk::PipelineBindPoint::GRAPHICS, self.tubos.cielo);
            d.cmd_bind_descriptor_sets(cb, vk::PipelineBindPoint::GRAPHICS, self.planos.cielo, 0, &[g_solo, g_cielo], &[(G_REF * G_PASO) as u32]);
            d.cmd_draw(cb, 3, 1, 0, 0); dibujos += 1;
            d.cmd_end_render_pass(cb);
            if let Some(t) = t { self.marcar_fin(cb, mi, t); }
        }
        // --- la escena: lo opaco y el cielo
        let (fb_esc, ao) = { let ds = self.dest.as_ref().unwrap(); (ds.fb_esc, ds.ao.as_ref().map(|(a, f)| (a.v, a.w, a.h, *f))) };
        let con_ao = ao.is_some();
        // (la profundidad se guarda si después alguien la lee: la oclusión o el agua; el color queda listo para cargarse)
        let guardar = con_ao || hay_agua;
        {
            let t = self.marcar(cb, mi, medir, "escena", true);
            let lim = [vk::ClearValue { color: vk::ClearColorValue { float32: [0.0, 0.0, 0.0, 1.0] } }, vk::ClearValue { depth_stencil: vk::ClearDepthStencilValue { depth: 1.0, stencil: 0 } }];
            d.cmd_begin_render_pass(cb, &vk::RenderPassBeginInfo::default().render_pass(if guardar { self.pasadas.esc_ao } else { self.pasadas.esc }).framebuffer(fb_esc).render_area(rect(w, h)).clear_values(&lim), vk::SubpassContents::INLINE);
            vista(&d, cb, w, h, 0.0);
            let cie = !l_cie.is_empty() || !l_tr_c.is_empty();
            if cie {
                // (el cielo 3D: el cielo, la maqueta y lo transparente de ella; la profundidad borrada; el mapa, siempre adelante)
                d.cmd_bind_pipeline(cb, vk::PipelineBindPoint::GRAPHICS, self.tubos.cielo);
                d.cmd_bind_descriptor_sets(cb, vk::PipelineBindPoint::GRAPHICS, self.planos.cielo, 0, &[g_solo, g_cielo], &[0]);
                d.cmd_draw(cb, 3, 1, 0, 0); dibujos += 1;
                d.cmd_bind_descriptor_sets(cb, vk::PipelineBindPoint::GRAPHICS, self.planos.luz, 0, &[g_glob], &[0]);
                dibujos += self.dibujar_lista(cb, &l_cie, false, true, g_obj, g_hue);
                dibujos += self.dibujar_transp(cb, &l_tr_c, g_glob, g_obj, g_hue);
                d.cmd_clear_attachments(cb, &[vk::ClearAttachment { aspect_mask: vk::ImageAspectFlags::DEPTH, color_attachment: 0, clear_value: vk::ClearValue { depth_stencil: vk::ClearDepthStencilValue { depth: 1.0, stencil: 0 } } }],
                    &[vk::ClearRect { rect: rect(w, h), base_array_layer: 0, layer_count: 1 }]);
            }
            d.cmd_bind_descriptor_sets(cb, vk::PipelineBindPoint::GRAPHICS, self.planos.luz, 0, &[g_glob], &[0]);
            if self.op.prepaso { dibujos += self.dibujar_pre(cb, &l_op, g_obj, g_hue); }
            if !pruebas.is_empty() {
                self.probar_cajas(cb, mi, &pruebas, inst_id, g_solo, g_obj)?; dibujos += pruebas.len() as u32;
                d.cmd_bind_descriptor_sets(cb, vk::PipelineBindPoint::GRAPHICS, self.planos.luz, 0, &[g_glob], &[0]);
            }
            dibujos += self.dibujar_lista(cb, &l_op, false, true, g_obj, g_hue);
            if !cie {
                d.cmd_bind_pipeline(cb, vk::PipelineBindPoint::GRAPHICS, self.tubos.cielo);
                d.cmd_bind_descriptor_sets(cb, vk::PipelineBindPoint::GRAPHICS, self.planos.cielo, 0, &[g_solo, g_cielo], &[0]);
                d.cmd_draw(cb, 3, 1, 0, 0); dibujos += 1;
            }
            if !con_ao {
                dibujos += self.dibujar_marcas(cb, mi, n_marcas, g_solo);
                dibujos += self.dibujar_transp(cb, &l_tr, g_glob, g_obj, g_hue);
                if !hay_agua { dibujos += self.dibujar_part(cb, mi, &p_dib, g_solo, g_part); }
            }
            d.cmd_end_render_pass(cb);
            if let Some(t) = t { self.marcar_fin(cb, mi, t); }
        }
        // --- la oclusión (desde la profundidad, a media resolución) y después lo transparente sobre la escena
        if let Some((av, aw, ah, afb)) = ao {
            let pv = self.dest.as_ref().unwrap().prof.v;
            let g_ao = self.grupo(mi, self.capas.ao)?;
            let ii = [vk::DescriptorImageInfo { sampler: vk::Sampler::null(), image_view: pv, image_layout: vk::ImageLayout::DEPTH_STENCIL_READ_ONLY_OPTIMAL }];
            d.update_descriptor_sets(&[vk::WriteDescriptorSet::default().dst_set(g_ao).dst_binding(0).descriptor_type(vk::DescriptorType::SAMPLED_IMAGE).image_info(&ii)], &[]);
            let t = self.marcar(cb, mi, medir, "ao", true);
            d.cmd_begin_render_pass(cb, &vk::RenderPassBeginInfo::default().render_pass(self.pasadas.ao).framebuffer(afb).render_area(rect(aw, ah)), vk::SubpassContents::INLINE);
            vista(&d, cb, aw, ah, 0.0);
            d.cmd_bind_pipeline(cb, vk::PipelineBindPoint::GRAPHICS, self.tubos.ao);
            d.cmd_bind_descriptor_sets(cb, vk::PipelineBindPoint::GRAPHICS, self.planos.ao, 0, &[g_solo, g_ao], &[0]);
            d.cmd_draw(cb, 3, 1, 0, 0);
            d.cmd_end_render_pass(cb);
            if let Some(t) = t { self.marcar_fin(cb, mi, t); }
            let g_aop = self.grupo_tex1(mi, av, self.s_cla, 4)?;
            let t = self.marcar(cb, mi, medir, "transp", true);
            d.cmd_begin_render_pass(cb, &vk::RenderPassBeginInfo::default().render_pass(self.pasadas.transp).framebuffer(fb_esc).render_area(rect(w, h)), vk::SubpassContents::INLINE);
            vista(&d, cb, w, h, 0.0);
            d.cmd_bind_pipeline(cb, vk::PipelineBindPoint::GRAPHICS, self.tubos.ao_poner);
            d.cmd_bind_descriptor_sets(cb, vk::PipelineBindPoint::GRAPHICS, self.planos.tex1, 0, &[g_aop], &[0]);
            d.cmd_draw(cb, 3, 1, 0, 0); dibujos += 2;
            dibujos += self.dibujar_marcas(cb, mi, n_marcas, g_solo);
            dibujos += self.dibujar_transp(cb, &l_tr, g_glob, g_obj, g_hue);
            if !hay_agua { dibujos += self.dibujar_part(cb, mi, &p_dib, g_solo, g_part); }
            d.cmd_end_render_pass(cb);
            if let Some(t) = t { self.marcar_fin(cb, mi, t); }
        }
        // --- el agua: ve a través de sí la copia de la escena, con la profundidad sólo para leer
        if hay_agua {
            // (el color de la escena quedó para leer —después de lo transparente— o como destino —sin oclusión—)
            let lay = if con_ao { vk::ImageLayout::SHADER_READ_ONLY_OPTIMAL } else { vk::ImageLayout::COLOR_ATTACHMENT_OPTIMAL };
            let (ci, rf) = { let ds = self.dest.as_ref().unwrap(); (ds.color.i, ds.refr.as_ref().unwrap().i) };
            use vk::AccessFlags as A; use vk::PipelineStageFlags as P;
            barrera2(&d, cb, ci, lay, vk::ImageLayout::TRANSFER_SRC_OPTIMAL, P::COLOR_ATTACHMENT_OUTPUT | P::FRAGMENT_SHADER, A::COLOR_ATTACHMENT_WRITE, P::TRANSFER, A::TRANSFER_READ);
            barrera2(&d, cb, rf, vk::ImageLayout::UNDEFINED, vk::ImageLayout::TRANSFER_DST_OPTIMAL, P::FRAGMENT_SHADER, A::empty(), P::TRANSFER, A::TRANSFER_WRITE);
            let cap = vk::ImageSubresourceLayers { aspect_mask: vk::ImageAspectFlags::COLOR, mip_level: 0, base_array_layer: 0, layer_count: 1 };
            d.cmd_copy_image(cb, ci, vk::ImageLayout::TRANSFER_SRC_OPTIMAL, rf, vk::ImageLayout::TRANSFER_DST_OPTIMAL, &[vk::ImageCopy { src_subresource: cap, src_offset: vk::Offset3D::default(), dst_subresource: cap, dst_offset: vk::Offset3D::default(), extent: vk::Extent3D { width: w, height: h, depth: 1 } }]);
            barrera2(&d, cb, rf, vk::ImageLayout::TRANSFER_DST_OPTIMAL, vk::ImageLayout::SHADER_READ_ONLY_OPTIMAL, P::TRANSFER, A::TRANSFER_WRITE, P::FRAGMENT_SHADER, A::SHADER_READ);
            barrera2(&d, cb, ci, vk::ImageLayout::TRANSFER_SRC_OPTIMAL, vk::ImageLayout::COLOR_ATTACHMENT_OPTIMAL, P::TRANSFER, A::TRANSFER_READ, P::COLOR_ATTACHMENT_OUTPUT, A::COLOR_ATTACHMENT_READ | A::COLOR_ATTACHMENT_WRITE);
            let g_agua = {
                let g = self.grupo(mi, self.capas.agua)?; let ds = self.dest.as_ref().unwrap();
                let refl_v = ds.refl.as_ref().map(|r| r.0.v).unwrap_or(self.blanca.v);
                let vistas = [self.agua_n.as_ref().unwrap().v, refl_v, self.agua_p.as_ref().map(|t| t.v).unwrap_or(self.blanca.v), ds.refr.as_ref().unwrap().v];
                let ii: Vec<[vk::DescriptorImageInfo; 1]> = vistas.iter().map(|&v| [vk::DescriptorImageInfo { sampler: vk::Sampler::null(), image_view: v, image_layout: vk::ImageLayout::SHADER_READ_ONLY_OPTIMAL }]).collect();
                let ip = [vk::DescriptorImageInfo { sampler: vk::Sampler::null(), image_view: ds.prof.v, image_layout: vk::ImageLayout::DEPTH_STENCIL_READ_ONLY_OPTIMAL }];
                let sr = [vk::DescriptorImageInfo { sampler: self.s_rep, image_view: vk::ImageView::null(), image_layout: vk::ImageLayout::UNDEFINED }];
                let sc = [vk::DescriptorImageInfo { sampler: self.s_cla, image_view: vk::ImageView::null(), image_layout: vk::ImageLayout::UNDEFINED }];
                let mut wr: Vec<vk::WriteDescriptorSet> = ii.iter().enumerate().map(|(k, i)| vk::WriteDescriptorSet::default().dst_set(g).dst_binding(k as u32).descriptor_type(vk::DescriptorType::SAMPLED_IMAGE).image_info(i)).collect();
                wr.push(vk::WriteDescriptorSet::default().dst_set(g).dst_binding(4).descriptor_type(vk::DescriptorType::SAMPLED_IMAGE).image_info(&ip));
                wr.push(vk::WriteDescriptorSet::default().dst_set(g).dst_binding(5).descriptor_type(vk::DescriptorType::SAMPLER).image_info(&sr));
                wr.push(vk::WriteDescriptorSet::default().dst_set(g).dst_binding(6).descriptor_type(vk::DescriptorType::SAMPLER).image_info(&sc));
                d.update_descriptor_sets(&wr, &[]); g
            };
            let t = self.marcar(cb, mi, medir, "agua", true);
            d.cmd_begin_render_pass(cb, &vk::RenderPassBeginInfo::default().render_pass(self.pasadas.transp).framebuffer(fb_esc).render_area(rect(w, h)), vk::SubpassContents::INLINE);
            vista(&d, cb, w, h, 0.0);
            d.cmd_bind_pipeline(cb, vk::PipelineBindPoint::GRAPHICS, self.tubos.agua);
            d.cmd_bind_descriptor_sets(cb, vk::PipelineBindPoint::GRAPHICS, self.planos.agua, 0, &[g_glob], &[0]);
            d.cmd_bind_descriptor_sets(cb, vk::PipelineBindPoint::GRAPHICS, self.planos.agua, 2, &[g_agua], &[]);
            let inst = self.marcos[mi].inst.b;
            for dd in &l_agua {
                let m = &self.mallas[&dd.m];
                d.cmd_bind_descriptor_sets(cb, vk::PipelineBindPoint::GRAPHICS, self.planos.agua, 1, &[g_obj], &[dd.obj]);
                d.cmd_bind_vertex_buffers(cb, 0, &[m.vb.b, inst], &[0, dd.inst]);
                d.cmd_bind_index_buffer(cb, m.ib.b, 0, if m.i32 { vk::IndexType::UINT32 } else { vk::IndexType::UINT16 });
                d.cmd_draw_indexed(cb, dd.sn, 1, dd.s0, 0, 0); dibujos += 1;
            }
            dibujos += self.dibujar_part(cb, mi, &p_dib, g_solo, g_part);
            d.cmd_end_render_pass(cb);
            if let Some(t) = t { self.marcar_fin(cb, mi, t); }
        }
        self.dibujos = dibujos;
        Ok(())
    }

    /// las marcas (frenadas, quemaduras, agujeros): después de lo opaco y la oclusión, antes de lo transparente, mezcladas,
    /// sin escribir la profundidad y despegadas hacia la cámara con el sesgo (como gpu.rs)
    unsafe fn dibujar_marcas(&self, cb: vk::CommandBuffer, mi: usize, n: u32, g_solo: vk::DescriptorSet) -> u32 {
        if n == 0 { return 0; }
        let d = &self.dev;
        d.cmd_bind_pipeline(cb, vk::PipelineBindPoint::GRAPHICS, self.tubos.marcas);
        d.cmd_bind_descriptor_sets(cb, vk::PipelineBindPoint::GRAPHICS, self.planos.lin, 0, &[g_solo], &[0]);
        d.cmd_bind_vertex_buffers(cb, 0, &[self.marcos[mi].marcas.b], &[0]);
        d.cmd_draw(cb, n, 1, 0, 0);
        1
    }
    /// las partículas, bloque por bloque (`l`: mezcla —0 alfa, 1 suma—, primera instancia y cuántas), cada uno con su derecha y
    /// su arriba (el desplazamiento de su lugar en el registro); miran la profundidad sin escribirla
    unsafe fn dibujar_part(&self, cb: vk::CommandBuffer, mi: usize, l: &[(usize, u32, u32)], g_solo: vk::DescriptorSet, g_part: vk::DescriptorSet) -> u32 {
        if l.is_empty() { return 0; }
        let d = &self.dev; let gr = vk::PipelineBindPoint::GRAPHICS;
        d.cmd_bind_vertex_buffers(cb, 0, &[self.marcos[mi].part.b], &[0]);
        d.cmd_bind_descriptor_sets(cb, gr, self.planos.part, 0, &[g_solo], &[0]);
        let mut act = None;
        for (k, &(mz, desde, n)) in l.iter().enumerate() {
            if act != Some(mz) { act = Some(mz); d.cmd_bind_pipeline(cb, gr, self.tubos.part[mz]); }
            d.cmd_bind_descriptor_sets(cb, gr, self.planos.part, 1, &[g_part], &[(k as u64 * U_PASO) as u32]);
            d.cmd_draw(cb, 6, n, 0, desde);
        }
        l.len() as u32
    }

    /// `op`: lo que no se recorta va con el sombreador sin descarte (no en el reflejo, que corta en el agua)
    unsafe fn dibujar_lista(&self, cb: vk::CommandBuffer, l: &[Dib], sombra: bool, op: bool, g_obj: vk::DescriptorSet, g_hue: vk::DescriptorSet) -> u32 {
        let mut act: Option<(bool, bool)> = None; let mut mk_act: Option<ClaveMat> = None;
        for dd in l {
            let sin = op && !dd.corte;
            if act != Some((dd.piel, sin)) {
                act = Some((dd.piel, sin)); mk_act = None;
                self.dev.cmd_bind_pipeline(cb, vk::PipelineBindPoint::GRAPHICS, match (sombra, dd.piel, sin) { (true, false, _) => self.tubos.sombra, (true, true, _) => self.tubos.sombra_piel,
                    (false, false, true) => self.tubos.luz_op[0], (false, true, true) => self.tubos.luz_op[1], (false, false, false) => self.tubos.luz[0], (false, true, false) => self.tubos.luz_piel[0] });
            }
            self.un_dib(cb, dd, sombra, &mut mk_act, g_obj, g_hue);
        }
        l.len() as u32
    }
    /// la pasada de profundidad (lo opaco sin recorte), de cerca a lejos
    /// la clave de una cosa para la oclusión (su malla, su parte, su material y dónde está), si vale la pena probarla: sin
    /// huesos, con al menos 32 triángulos y no pegada a la cámara (como gpu.rs)
    fn oclu_clave(&self, i: usize) -> Option<u64> {
        let it = &self.items[i]; let c = self.c.as_ref()?;
        if !it.h.is_empty() || it.sn < 96 || it.esf[3] < 0.3 { return None; }
        let (x, y, z) = (it.esf[0] - c.pos[0], it.esf[1] - c.pos[1], it.esf[2] - c.pos[2]);
        if (x * x + y * y + z * z).sqrt() < it.esf[3] * 1.8 + 1.5 { return None; }
        let q = |v: f32| (v * 4.0).round() as i64 as u64;
        let mut h = (it.m as u64).wrapping_mul(0x9E3779B97F4A7C15) ^ (it.s0 as u64).wrapping_mul(0xC2B2AE3D27D4EB4F) ^ (it.mat as u64).wrapping_mul(0x165667B19E3779F9);
        for v in [q(it.esf[0]), q(it.esf[1]), q(it.esf[2])] { h = (h ^ v).wrapping_mul(0x100000001B3); }
        Some(h)
    }
    /// los resultados de las cajas que probó este cuadro en vuelo (ya terminó: su valla pasó); lo que no se prueba hace rato se olvida
    unsafe fn oclu_leer(&mut self, mi: usize) {
        let ks = std::mem::take(&mut self.marcos[mi].oq_claves);
        if !ks.is_empty() {
            let mut r = vec![0u32; ks.len()];
            if self.dev.get_query_pool_results(self.marcos[mi].oq, 0, &mut r, vk::QueryResultFlags::empty()).is_ok() {
                for (k, v) in ks.iter().zip(r) { self.oclu.insert(*k, (v != 0, self.cuadro)); }
            }
        }
        let viejo = self.cuadro.saturating_sub(300); self.oclu.retain(|_, e| e.1 >= viejo);
    }
    /// prueba las cajas contra la profundidad que dejó la pasada de profundidad (sin escribir nada)
    unsafe fn probar_cajas(&mut self, cb: vk::CommandBuffer, mi: usize, pruebas: &[(u32, u64)], inst: u64, g_solo: vk::DescriptorSet, g_obj: vk::DescriptorSet) -> Result<(), String> {
        if self.caja.is_none() {
            // (la caja de 0 a 1 en posiciones de 16 bits, con el paso de 16 bytes de las mallas)
            let mut v = vec![0u8; 8 * 16];
            for k in 0..8usize { for e in 0..3 { let x: u16 = if k >> e & 1 == 1 { 65535 } else { 0 }; v[k * 16 + e * 2..k * 16 + e * 2 + 2].copy_from_slice(&x.to_le_bytes()); } }
            let caras: [u16; 36] = [0, 1, 3, 0, 3, 2, 4, 6, 7, 4, 7, 5, 0, 4, 5, 0, 5, 1, 2, 3, 7, 2, 7, 6, 0, 2, 6, 0, 6, 4, 1, 5, 7, 1, 7, 3];
            let ib: Vec<u8> = caras.iter().flat_map(|x| x.to_le_bytes()).collect();
            self.caja = Some((self.buf_fijo(&v, vk::BufferUsageFlags::VERTEX_BUFFER)?, self.buf_fijo(&ib, vk::BufferUsageFlags::INDEX_BUFFER)?));
        }
        let d = &self.dev; let (vb, ib) = { let c = self.caja.as_ref().unwrap(); (c.0.b, c.1.b) }; let oq = self.marcos[mi].oq; let ib_inst = self.marcos[mi].inst.b;
        d.cmd_bind_pipeline(cb, vk::PipelineBindPoint::GRAPHICS, self.tubos.caja);
        d.cmd_bind_descriptor_sets(cb, vk::PipelineBindPoint::GRAPHICS, self.planos.sombra, 0, &[g_solo], &[0]);
        d.cmd_bind_vertex_buffers(cb, 0, &[vb, ib_inst], &[0, inst]); d.cmd_bind_index_buffer(cb, ib, 0, vk::IndexType::UINT16);
        for (n, &(o, k)) in pruebas.iter().enumerate() {
            d.cmd_bind_descriptor_sets(cb, vk::PipelineBindPoint::GRAPHICS, self.planos.sombra, 1, &[g_obj], &[o]);
            d.cmd_begin_query(cb, oq, n as u32, vk::QueryControlFlags::empty()); d.cmd_draw_indexed(cb, 36, 1, 0, 0, 0); d.cmd_end_query(cb, oq, n as u32);
            self.marcos[mi].oq_claves.push(k);
        }
        Ok(())
    }
    /// la huella de una cascada: su matriz y lo que tiene adentro (malla, pedazo, material, lugar y huesos de cada cosa)
    fn huella(&self, svp: &M4, lista: &[usize]) -> u64 {
        let mut h: u64 = 0xcbf29ce484222325; let mut mete = |x: u64| { h ^= x; h = h.wrapping_mul(0x100000001b3); };
        for v in svp { mete(v.to_bits() as u64); }
        for &i in lista { let it = &self.items[i]; mete(it.m as u64); mete(it.s0 as u64); mete(it.mat as u64); for v in &it.mm { mete(v.to_bits() as u64); } for v in &it.h { mete(v.to_bits() as u64); } }
        h.max(1)
    }
    unsafe fn dibujar_pre(&self, cb: vk::CommandBuffer, l: &[Dib], g_obj: vk::DescriptorSet, g_hue: vk::DescriptorSet) -> u32 {
        let mut orden: Vec<&Dib> = l.iter().filter(|d| !d.corte).collect(); orden.sort_by(|a, b| a.lejos.total_cmp(&b.lejos));
        let mut act: Option<bool> = None; let mut mk_act: Option<ClaveMat> = None; let mut n = 0;
        for dd in orden {
            if act != Some(dd.piel) { act = Some(dd.piel); mk_act = None; self.dev.cmd_bind_pipeline(cb, vk::PipelineBindPoint::GRAPHICS, self.tubos.pre[dd.piel as usize]); }
            self.un_dib(cb, dd, false, &mut mk_act, g_obj, g_hue); n += 1;
        }
        n
    }
    unsafe fn dibujar_transp(&self, cb: vk::CommandBuffer, l: &[Dib], g_glob: vk::DescriptorSet, g_obj: vk::DescriptorSet, g_hue: vk::DescriptorSet) -> u32 {
        if l.is_empty() { return 0; }
        self.dev.cmd_bind_descriptor_sets(cb, vk::PipelineBindPoint::GRAPHICS, self.planos.luz, 0, &[g_glob], &[0]);
        let mut act: Option<(bool, u8)> = None; let mut mk_act: Option<ClaveMat> = None;
        for dd in l {
            if act != Some((dd.piel, dd.mezcla)) { act = Some((dd.piel, dd.mezcla)); self.dev.cmd_bind_pipeline(cb, vk::PipelineBindPoint::GRAPHICS, if dd.piel { self.tubos.luz_piel[dd.mezcla as usize] } else { self.tubos.luz[dd.mezcla as usize] }); }
            self.un_dib(cb, dd, false, &mut mk_act, g_obj, g_hue);
        }
        l.len() as u32
    }
    unsafe fn un_dib(&self, cb: vk::CommandBuffer, dd: &Dib, sombra: bool, mk_act: &mut Option<ClaveMat>, g_obj: vk::DescriptorSet, g_hue: vk::DescriptorSet) {
        let d = &self.dev; let m = &self.mallas[&dd.m];
        let (pl, plp) = if sombra { (self.planos.sombra, self.planos.sombra_piel) } else { (self.planos.luz, self.planos.luz_piel) };
        d.cmd_bind_descriptor_sets(cb, vk::PipelineBindPoint::GRAPHICS, pl, 1, &[g_obj], &[dd.obj]);
        if let Some(h) = dd.hue { if dd.piel { d.cmd_bind_descriptor_sets(cb, vk::PipelineBindPoint::GRAPHICS, plp, 3, &[g_hue], &[h]); } }
        let inst = self.marcos[self.marco].inst.b;
        if sombra {
            d.cmd_bind_vertex_buffers(cb, 0, &[m.vb.b, inst], &[0, dd.inst]);
            if let (Some(s), true) = (&m.piel, dd.piel) { d.cmd_bind_vertex_buffers(cb, 2, &[s.b], &[0]); }
        } else {
            if *mk_act != Some(dd.mk) { if let Some(g) = self.g_mat.get(&dd.mk) { d.cmd_bind_descriptor_sets(cb, vk::PipelineBindPoint::GRAPHICS, pl, 2, &[*g], &[]); } *mk_act = Some(dd.mk); }
            let ceros = self.mallas.get(&i64::MIN).map(|c| c.vb.b).unwrap_or(m.vb.b);
            d.cmd_bind_vertex_buffers(cb, 0, &[m.vb.b, m.lm.as_ref().map(|b| b.b).unwrap_or(ceros), inst], &[0, 0, dd.inst]);
            if let (Some(s), true) = (&m.piel, dd.piel) { d.cmd_bind_vertex_buffers(cb, 3, &[s.b], &[0]); }
        }
        d.cmd_bind_index_buffer(cb, m.ib.b, 0, if m.i32 { vk::IndexType::UINT32 } else { vk::IndexType::UINT16 });
        d.cmd_draw_indexed(cb, dd.sn, dd.n, dd.s0, 0, 0);
    }

    // ———— los tiempos de la placa ————
    unsafe fn marcar(&mut self, cb: vk::CommandBuffer, mi: usize, medir: bool, n: &'static str, _ini: bool) -> Option<u32> {
        if !medir { return None; }
        let m = &mut self.marcos[mi]; let q = m.q?; let k = m.nombres.len() as u32 * 2;
        if k + 1 >= NTIEMPOS { return None; }
        m.nombres.push(n); self.dev.cmd_write_timestamp(cb, vk::PipelineStageFlags::TOP_OF_PIPE, q, k); Some(k + 1)
    }
    unsafe fn marcar_fin(&self, cb: vk::CommandBuffer, mi: usize, k: u32) { if let Some(q) = self.marcos[mi].q { self.dev.cmd_write_timestamp(cb, vk::PipelineStageFlags::BOTTOM_OF_PIPE, q, k); } }
    unsafe fn leer_tiempos(&mut self, mi: usize) {
        let m = &self.marcos[mi]; let (Some(q), true) = (m.q, m.usado && !m.nombres.is_empty()) else { return };
        let n = m.nombres.len() * 2; let mut x = vec![0u64; n];
        if self.dev.get_query_pool_results(q, 0, &mut x, vk::QueryResultFlags::TYPE_64).is_ok() {
            let per = self.periodo as f64 / 1e6;
            self.tiempos = m.nombres.iter().enumerate().map(|(i, nm)| (*nm, (x[2 * i + 1].saturating_sub(x[2 * i]) as f64 * per) as f32)).collect();
        }
        self.marcos[mi].nombres.clear();
    }
    /// lo que tardó cada pasada en la placa la última vez que se midió, y el total
    pub fn tiempos_placa(&self) -> Option<(f32, String)> {
        if self.tiempos.is_empty() { return None; }
        Some((self.tiempos.iter().map(|x| x.1).sum(), self.tiempos.iter().map(|(n, m)| format!("{n} {m:.1}")).collect::<Vec<_>>().join(" · ")))
    }

    /// la altura del piso que se reflejó en el último cuadro (None: no hubo reflejo del piso)
    pub fn piso_refleja(&self) -> Option<f32> { self.refl_piso }
    /// el piso de abajo de la cámara para su reflejo (Definitivo, como gpu.rs): el que da el juego (`suelo_y`), no muy lejos, si
    /// a la vista y cerca hay algo opaco que lo cruza
    fn piso_reflejo(&self) -> Option<f32> {
        let c = self.c.as_ref()?; let y = c.suelo_y.filter(|&y| (0.2..25.0).contains(&(c.pos[1] - y)))?;
        let pl = mat::planos(&c.vp); let cp = c.pos;
        self.opacos.iter().any(|&i| { let e = self.items[i].esf;
            e[3] > 0.0 && (e[1] - y).abs() < e[3] && ((e[0] - cp[0]).powi(2) + (e[2] - cp[2]).powi(2)).sqrt() - e[3] < 50.0 && mat::esfera_dentro(&pl, &e) }).then_some(y)
    }
    pub fn resumen(&self) -> String {
        format!("mapa {} · {} mallas · {} texturas · {} luces horneadas · {} materiales · {:.1} MB en la placa · {} cosas en el cuadro ({} opacas, {} transparentes)",
            self.mapa, self.mallas.len().saturating_sub(self.mallas.contains_key(&i64::MIN) as usize), self.texs.len(), self.lms.len(), self.mats.len(), self.memoria as f64 / 1e6, self.items.len(), self.opacos.len(), self.transp.len())
    }
}

impl Drop for Motor {
    fn drop(&mut self) {
        unsafe {
            let _ = self.dev.device_wait_idle();
            self.vaciar();
            if let Some(d) = self.dest.take() { self.soltar_dest(d); }
            if let Some((i, f, _)) = self.sombra.take() { self.dev.destroy_framebuffer(f, None); self.soltar_img(&i); }
            if let Some(c) = self.cadena.take() { self.soltar_cadena(c); }
            if let Some(p) = self.propia.take() { self.dev.destroy_framebuffer(p.fb, None); self.soltar_img(&p.img); self.soltar_buf(&p.leer); }
            for i in [&self.blanca, &self.cubo0, &self.prof0] { self.soltar_img(i); }
            for m in std::mem::take(&mut self.marcos) {
                for b in [&m.glob, &m.obj, &m.hue, &m.inst, &m.post, &m.ui, &m.uiu, &m.part, &m.partu, &m.marcas] { self.soltar_buf(b); }
                self.dev.destroy_fence(m.listo, None); self.dev.destroy_semaphore(m.sem_img, None); self.dev.destroy_descriptor_pool(m.pool, None);
                if let Some(q) = m.q { self.dev.destroy_query_pool(q, None); }
                self.dev.destroy_query_pool(m.oq, None);
            }
            self.dev.destroy_descriptor_pool(self.pool_mat, None);
            let t = &self.tubos;
            for p in t.luz.iter().chain(t.luz_piel.iter()).chain(t.luz_op.iter()).chain(t.pre.iter()).chain(t.part.iter()).chain([t.sombra, t.sombra_piel, t.cielo, t.ao, t.ao_poner, t.fin, t.ui, t.agua, t.marcas, t.caja].iter()) { self.dev.destroy_pipeline(*p, None); }
            if let Some((a, b)) = self.caja.take() { self.soltar_buf(&a); self.soltar_buf(&b); }
            for m in &self.mods { self.dev.destroy_shader_module(*m, None); }
            let p = &self.planos;
            for l in [p.luz, p.luz_piel, p.sombra, p.sombra_piel, p.cielo, p.ao, p.tex1, p.agua, p.part, p.lin] { self.dev.destroy_pipeline_layout(l, None); }
            let c = &self.capas;
            for l in [c.glob, c.glob_solo, c.obj, c.mat, c.hue, c.cielo, c.ao, c.tex1, c.vacia, c.agua] { self.dev.destroy_descriptor_set_layout(l, None); }
            let r = &self.pasadas;
            for x in [r.sombra, r.sombra_parcial, r.esc_ao, r.esc, r.ao, r.transp, r.fin, r.fin_propia, r.refl] { self.dev.destroy_render_pass(x, None); }
            for s in [self.s_rep, self.s_cla, self.s_cmp] { self.dev.destroy_sampler(s, None); }
            self.dev.destroy_command_pool(self.cmd_pool, None);
            self.dev.destroy_device(None);
            if let Some(si) = &self.sup_i { si.destroy_surface(self.sup, None); }
            self.inst.destroy_instance(None);
        }
    }
}

/// (las pruebas en la compu: ver gpu::vk_sin_ventana)
impl crate::gpu::FotoVk for Motor {
    unsafe fn cargar(&mut self, e: &Escena) -> Result<(), String> { Motor::cargar(self, e) }
    fn poner_cuadro(&mut self, c: Cuadro) { Motor::poner_cuadro(self, c) }
    unsafe fn foto(&mut self) -> Result<Vec<u8>, String> { self.dibujar(&[])?; self.leer_imagen().ok_or_else(|| "sin imagen propia".to_string()) }
    fn tiempos(&self) -> Option<(f32, String)> { self.tiempos_placa() }
    fn placa(&self) -> String { self.placa.clone() }
}

impl Img { fn nula() -> Img { Img { i: vk::Image::null(), m: vk::DeviceMemory::null(), v: vk::ImageView::null(), w: 0, h: 0, bytes: 0 } } }

fn rect(w: u32, h: u32) -> vk::Rect2D { vk::Rect2D { offset: vk::Offset2D::default(), extent: vk::Extent2D { width: w, height: h } } }
unsafe fn vista(d: &ash::Device, cb: vk::CommandBuffer, w: u32, h: u32, _z: f32) { vista_en(d, cb, 0.0, 0.0, w as f32, h as f32); }
unsafe fn vista_en(d: &ash::Device, cb: vk::CommandBuffer, x: f32, y: f32, w: f32, h: f32) {
    d.cmd_set_viewport(cb, 0, &[vk::Viewport { x, y, width: w, height: h, min_depth: 0.0, max_depth: 1.0 }]);
    d.cmd_set_scissor(cb, 0, &[vk::Rect2D { offset: vk::Offset2D { x: x as i32, y: y as i32 }, extent: vk::Extent2D { width: w as u32, height: h as u32 } }]);
}

/// un cambio de disposición de una imagen de color con las etapas y los accesos dichos
unsafe fn barrera2(d: &ash::Device, cb: vk::CommandBuffer, i: vk::Image, de: vk::ImageLayout, a: vk::ImageLayout, ss: vk::PipelineStageFlags, sa: vk::AccessFlags, ds: vk::PipelineStageFlags, da: vk::AccessFlags) {
    let b = vk::ImageMemoryBarrier::default().src_access_mask(sa).dst_access_mask(da).old_layout(de).new_layout(a).src_queue_family_index(vk::QUEUE_FAMILY_IGNORED).dst_queue_family_index(vk::QUEUE_FAMILY_IGNORED)
        .image(i).subresource_range(vk::ImageSubresourceRange { aspect_mask: vk::ImageAspectFlags::COLOR, base_mip_level: 0, level_count: 1, base_array_layer: 0, layer_count: 1 });
    d.cmd_pipeline_barrier(cb, ss, ds, vk::DependencyFlags::empty(), &[], &[], &[b]);
}

/// el pool de los grupos de un cuadro (se vacía entero cada vez)
unsafe fn pool_cuadro(d: &ash::Device) -> Result<vk::DescriptorPool, String> {
    use vk::DescriptorType as DT;
    let ps = [vk::DescriptorPoolSize { ty: DT::UNIFORM_BUFFER_DYNAMIC, descriptor_count: 64 }, vk::DescriptorPoolSize { ty: DT::SAMPLED_IMAGE, descriptor_count: 64 }, vk::DescriptorPoolSize { ty: DT::SAMPLER, descriptor_count: 64 }];
    ve(d.create_descriptor_pool(&vk::DescriptorPoolCreateInfo::default().max_sets(32).pool_sizes(&ps), None), "pool de grupos")
}

/// un cambio de disposición de una imagen (subir texturas, dejar la profundidad lista para leer)
unsafe fn barrera(d: &ash::Device, cb: vk::CommandBuffer, i: vk::Image, aspecto: vk::ImageAspectFlags, de: vk::ImageLayout, a: vk::ImageLayout, nivel0: u32, niveles: u32, capas: u32) {
    let (sa, ss) = if de == vk::ImageLayout::TRANSFER_DST_OPTIMAL { (vk::AccessFlags::TRANSFER_WRITE, vk::PipelineStageFlags::TRANSFER) } else { (vk::AccessFlags::empty(), vk::PipelineStageFlags::TOP_OF_PIPE) };
    let (da, ds) = if a == vk::ImageLayout::TRANSFER_DST_OPTIMAL { (vk::AccessFlags::TRANSFER_WRITE, vk::PipelineStageFlags::TRANSFER) } else { (vk::AccessFlags::SHADER_READ, vk::PipelineStageFlags::FRAGMENT_SHADER) };
    let b = vk::ImageMemoryBarrier::default().src_access_mask(sa).dst_access_mask(da).old_layout(de).new_layout(a).src_queue_family_index(vk::QUEUE_FAMILY_IGNORED).dst_queue_family_index(vk::QUEUE_FAMILY_IGNORED)
        .image(i).subresource_range(vk::ImageSubresourceRange { aspect_mask: aspecto, base_mip_level: nivel0, level_count: niveles, base_array_layer: 0, layer_count: capas });
    d.cmd_pipeline_barrier(cb, ss, ds, vk::DependencyFlags::empty(), &[], &[], &[b]);
}

/// una pasada de una sola etapa: color (formato, cargar, guardar, disposición de entrada y de salida) y profundidad (lo mismo y
/// si es sólo para leer). Con dependencias amplias hacia afuera: lo que escribe queda listo para leerse después
unsafe fn pasada(d: &ash::Device, color: Option<(vk::Format, vk::AttachmentLoadOp, vk::AttachmentStoreOp, vk::ImageLayout, vk::ImageLayout)>,
    prof: Option<(vk::Format, vk::AttachmentLoadOp, vk::AttachmentStoreOp, vk::ImageLayout, vk::ImageLayout, bool)>) -> Result<vk::RenderPass, String> {
    let mut at = vec![]; let mut cref = vec![]; let mut pref = None;
    if let Some((f, l, s, i, o)) = color {
        cref.push(vk::AttachmentReference { attachment: at.len() as u32, layout: vk::ImageLayout::COLOR_ATTACHMENT_OPTIMAL });
        at.push(vk::AttachmentDescription::default().format(f).samples(vk::SampleCountFlags::TYPE_1).load_op(l).store_op(s).stencil_load_op(vk::AttachmentLoadOp::DONT_CARE).stencil_store_op(vk::AttachmentStoreOp::DONT_CARE).initial_layout(i).final_layout(o));
    }
    if let Some((f, l, s, i, o, solo_leer)) = prof {
        pref = Some(vk::AttachmentReference { attachment: at.len() as u32, layout: if solo_leer { vk::ImageLayout::DEPTH_STENCIL_READ_ONLY_OPTIMAL } else { vk::ImageLayout::DEPTH_STENCIL_ATTACHMENT_OPTIMAL } });
        at.push(vk::AttachmentDescription::default().format(f).samples(vk::SampleCountFlags::TYPE_1).load_op(l).store_op(s).stencil_load_op(vk::AttachmentLoadOp::DONT_CARE).stencil_store_op(vk::AttachmentStoreOp::DONT_CARE).initial_layout(i).final_layout(o));
    }
    let mut sp = vk::SubpassDescription::default().pipeline_bind_point(vk::PipelineBindPoint::GRAPHICS).color_attachments(&cref);
    if let Some(p) = pref.as_ref() { sp = sp.depth_stencil_attachment(p); }
    use vk::AccessFlags as A; use vk::PipelineStageFlags as P;
    let escribe = A::COLOR_ATTACHMENT_WRITE | A::DEPTH_STENCIL_ATTACHMENT_WRITE;
    let todo = A::SHADER_READ | A::COLOR_ATTACHMENT_READ | A::COLOR_ATTACHMENT_WRITE | A::DEPTH_STENCIL_ATTACHMENT_READ | A::DEPTH_STENCIL_ATTACHMENT_WRITE;
    let etapas = P::FRAGMENT_SHADER | P::EARLY_FRAGMENT_TESTS | P::LATE_FRAGMENT_TESTS | P::COLOR_ATTACHMENT_OUTPUT;
    let dep = [
        vk::SubpassDependency { src_subpass: vk::SUBPASS_EXTERNAL, dst_subpass: 0, src_stage_mask: etapas, dst_stage_mask: etapas, src_access_mask: escribe, dst_access_mask: todo, dependency_flags: vk::DependencyFlags::BY_REGION },
        vk::SubpassDependency { src_subpass: 0, dst_subpass: vk::SUBPASS_EXTERNAL, src_stage_mask: etapas, dst_stage_mask: etapas | P::TRANSFER, src_access_mask: escribe, dst_access_mask: todo | A::TRANSFER_READ, dependency_flags: vk::DependencyFlags::empty() },
    ];
    let sps = [sp];
    ve(d.create_render_pass(&vk::RenderPassCreateInfo::default().attachments(&at).subpasses(&sps).dependencies(&dep), None), "pasada")
}

/// una tubería: el módulo y sus entradas, el plano, la pasada, los búferes (paso, por instancia) y los atributos (lugar,
/// búfer, formato, desde), la mezcla (0 nada, 1 alfa, 2 suma, 3 multiplicar) y la profundidad (escribe, comparación, sesgo:
/// constante y por la pendiente)
#[allow(clippy::too_many_arguments)]
unsafe fn tubo(d: &ash::Device, m: vk::ShaderModule, vs: &str, fs: Option<&str>, pl: vk::PipelineLayout, rp: vk::RenderPass, bufs: &[(u32, bool)], ats: &[(u32, u32, vk::Format, u32)],
    mezcla: u8, prof: Option<(bool, vk::CompareOp, (f32, f32))>) -> Result<vk::Pipeline, String> {
    let nv = CString::new(vs).unwrap(); let nf = fs.map(|f| CString::new(f).unwrap());
    let mut etapas = vec![vk::PipelineShaderStageCreateInfo::default().stage(vk::ShaderStageFlags::VERTEX).module(m).name(&nv)];
    if let Some(f) = nf.as_ref() { etapas.push(vk::PipelineShaderStageCreateInfo::default().stage(vk::ShaderStageFlags::FRAGMENT).module(m).name(f.as_c_str())); }
    let vb: Vec<_> = bufs.iter().enumerate().map(|(i, &(paso, inst))| vk::VertexInputBindingDescription { binding: i as u32, stride: paso, input_rate: if inst { vk::VertexInputRate::INSTANCE } else { vk::VertexInputRate::VERTEX } }).collect();
    let va: Vec<_> = ats.iter().map(|&(loc, b, f, o)| vk::VertexInputAttributeDescription { location: loc, binding: b, format: f, offset: o }).collect();
    let vi = vk::PipelineVertexInputStateCreateInfo::default().vertex_binding_descriptions(&vb).vertex_attribute_descriptions(&va);
    let ia = vk::PipelineInputAssemblyStateCreateInfo::default().topology(vk::PrimitiveTopology::TRIANGLE_LIST);
    let vpst = vk::PipelineViewportStateCreateInfo::default().viewport_count(1).scissor_count(1);
    let (bc, bp) = prof.map(|p| p.2).unwrap_or(SESGO_NO); let sesgo = bc != 0.0 || bp != 0.0;
    let rs = vk::PipelineRasterizationStateCreateInfo::default().polygon_mode(vk::PolygonMode::FILL).cull_mode(vk::CullModeFlags::NONE).front_face(vk::FrontFace::COUNTER_CLOCKWISE).line_width(1.0)
        .depth_bias_enable(sesgo).depth_bias_constant_factor(bc).depth_bias_slope_factor(bp);
    let ms = vk::PipelineMultisampleStateCreateInfo::default().rasterization_samples(vk::SampleCountFlags::TYPE_1);
    let ds = match prof { Some((w, c, _)) => vk::PipelineDepthStencilStateCreateInfo::default().depth_test_enable(true).depth_write_enable(w).depth_compare_op(c), None => vk::PipelineDepthStencilStateCreateInfo::default() };
    use vk::BlendFactor as BF;
    let (ac, sc, dc, sa, da) = match mezcla { 1 => (true, BF::SRC_ALPHA, BF::ONE_MINUS_SRC_ALPHA, BF::SRC_ALPHA, BF::ONE_MINUS_SRC_ALPHA), 2 => (true, BF::SRC_ALPHA, BF::ONE, BF::SRC_ALPHA, BF::ONE), 3 => (true, BF::ZERO, BF::SRC_COLOR, BF::ZERO, BF::ONE), _ => (false, BF::ONE, BF::ZERO, BF::ONE, BF::ZERO) };
    let cba = [vk::PipelineColorBlendAttachmentState::default().blend_enable(ac).src_color_blend_factor(sc).dst_color_blend_factor(dc).color_blend_op(vk::BlendOp::ADD)
        .src_alpha_blend_factor(sa).dst_alpha_blend_factor(da).alpha_blend_op(vk::BlendOp::ADD).color_write_mask(if mezcla == 4 { vk::ColorComponentFlags::empty() } else { vk::ColorComponentFlags::RGBA })];
    let cb = vk::PipelineColorBlendStateCreateInfo::default().attachments(if fs.is_some() || mezcla == 4 { &cba[..] } else { &cba[..0] });
    let din = [vk::DynamicState::VIEWPORT, vk::DynamicState::SCISSOR];
    let dy = vk::PipelineDynamicStateCreateInfo::default().dynamic_states(&din);
    let mut info = vk::GraphicsPipelineCreateInfo::default().stages(&etapas).vertex_input_state(&vi).input_assembly_state(&ia).viewport_state(&vpst).rasterization_state(&rs)
        .multisample_state(&ms).color_blend_state(&cb).dynamic_state(&dy).layout(pl).render_pass(rp).subpass(0);
    if prof.is_some() { info = info.depth_stencil_state(&ds); }
    d.create_graphics_pipelines(vk::PipelineCache::null(), &[info], None).map(|v| v[0]).map_err(|(_, e)| format!("tubería {vs}: {e:?}"))
}

/// el nivel siguiente de una imagen RGBA (promedio de a 4)
pub fn mitad(px: &[u8], w: u32, h: u32, nw: u32, nh: u32) -> Vec<u8> {
    let mut o = vec![0u8; (nw * nh * 4) as usize];
    for y in 0..nh { for x in 0..nw { for c in 0..4 {
        let p = |xx: u32, yy: u32| px[((yy.min(h - 1) * w + xx.min(w - 1)) * 4 + c) as usize] as u32;
        o[((y * nw + x) * 4 + c) as usize] = ((p(2 * x, 2 * y) + p(2 * x + 1, 2 * y) + p(2 * x, 2 * y + 1) + p(2 * x + 1, 2 * y + 1) + 2) / 4) as u8;
    } } }
    o
}
#[allow(dead_code)]
fn _no_usado(_: &CStr) {}
