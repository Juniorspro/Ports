//! JX Motor sobre wgpu: Vulkan en Android (GLES de respaldo en los celulares sin Vulkan), y en la compu el Vulkan de Mesa
//! para el banco de pruebas. Dibuja lo mismo que el motor de GLES (gpu.rs) y con la misma entrada:
//!  - recursos que llegan de a poco (mallas, texturas, luces horneadas, materiales, agua y cielo) con su número del juego;
//!  - cada cuadro: cámara, sol, luces y la lista de lo que se dibuja (lugares fijos, JXC2), con sus matrices y huesos.
//! Las pasadas: sombra del sol, reflejo del agua, la escena (cielo, lo opaco con instancias, oclusión, marcas, lo
//! transparente), el agua con refracción, las partículas y la imagen final (estirada, con el retoque).
//! Cada cuadro arma primero todo lo que va a la placa (las cabeceras de cada pasada, un registro por malla y material, las
//! matrices de las copias y los huesos de cada personaje una sola vez), lo sube en cuatro escrituras y después dibuja.
use crate::escena::{Agua, Cielo, Cuadro, Escena, ItemDin, Mat, EF_MARCAS, EF_PART_ALFA, EF_PART_SUMA, FL_SIN_SOMBRA};
use crate::gpu::{Opciones, MAX_HUESOS, MAX_LUCES, TEX_ATLAS};
use crate::mat::{self, M4};
use crate::wgsl;
use std::collections::HashMap;
use std::num::NonZeroU64;

const FMT: wgpu::TextureFormat = wgpu::TextureFormat::Rgba8Unorm;
const FMT_P: wgpu::TextureFormat = wgpu::TextureFormat::Depth32Float;
/// los registros de la placa (con lugar para el desplazamiento dinámico, de a 256 bytes)
const G_PASO: u64 = 1024;
const O_PASO: u64 = 256;
const H_PASO: u64 = 2816;
const U_PASO: u64 = 256;
const G_TAM: u64 = 992;
const O_TAM: u64 = 128;
const H_TAM: u64 = 2688;
const U_TAM: u64 = 32;
/// cabeceras: 0 la cámara, 1 el reflejo, 2 la sombra
const G_CAM: u32 = 0;
const G_REF: u32 = 1;
const G_SOM: u32 = 2;

struct MallaW { vb: wgpu::Buffer, ib: wgpu::Buffer, lm: Option<wgpu::Buffer>, piel: Option<wgpu::Buffer>, i32: bool, mn: [f32; 3], sc: [f32; 3], lm_id: i64, v: u32, bytes: usize }
struct TexW { v: wgpu::TextureView, bytes: usize, _t: wgpu::Texture }
struct Rt { color: wgpu::Texture, cv: wgpu::TextureView, _prof: wgpu::Texture, pv: wgpu::TextureView, w: u32, h: u32 }
struct Color1 { t: wgpu::Texture, v: wgpu::TextureView, w: u32, h: u32 }
type ClaveMat = [i64; 5];

/// un dibujo: malla y parte, el registro de su material, sus matrices (desde y cuántas) y sus huesos
#[derive(Clone)]
struct Dib { m: i64, s0: u32, sn: u32, obj: u32, inst: u64, n: u32, hue: Option<u32>, mk: ClaveMat, mezcla: u8, piel: bool }

/// lo que se arma en la memoria antes de subirlo
#[derive(Default)]
struct Arm { obj: Vec<f32>, porobj: HashMap<(i64, i64, u8), u32>, inst: Vec<f32>, hue: Vec<f32>, porhue: HashMap<u64, u32>, claves: Vec<ClaveMat> }

struct Capas { glob: wgpu::BindGroupLayout, glob_solo: wgpu::BindGroupLayout, obj: wgpu::BindGroupLayout, mat: wgpu::BindGroupLayout, hue: wgpu::BindGroupLayout, agua: wgpu::BindGroupLayout, cielo: wgpu::BindGroupLayout, ao: wgpu::BindGroupLayout, tex1: wgpu::BindGroupLayout }
struct Tubos { luz: Vec<wgpu::RenderPipeline>, luz_piel: Vec<wgpu::RenderPipeline>, sombra: wgpu::RenderPipeline, sombra_piel: wgpu::RenderPipeline, agua: wgpu::RenderPipeline, cielo: wgpu::RenderPipeline, ao: wgpu::RenderPipeline, ao_poner: wgpu::RenderPipeline, part: Vec<wgpu::RenderPipeline>, lin: wgpu::RenderPipeline, post: wgpu::ShaderModule, pl_post: wgpu::PipelineLayout }

/// un búfer que crece (se rehace más grande y se avisa para rehacer lo que lo usa)
struct Buf { b: wgpu::Buffer, tam: u64, uso: wgpu::BufferUsages, nombre: &'static str }
impl Buf {
    fn nuevo(d: &wgpu::Device, nombre: &'static str, tam: u64, uso: wgpu::BufferUsages) -> Buf {
        let uso = uso | wgpu::BufferUsages::COPY_DST;
        Buf { b: d.create_buffer(&wgpu::BufferDescriptor { label: Some(nombre), size: tam, usage: uso, mapped_at_creation: false }), tam, uso, nombre }
    }
    /// sube los bytes (agrandando si no entran); devuelve si se rehízo
    fn subir(&mut self, d: &wgpu::Device, q: &wgpu::Queue, datos: &[u8]) -> bool {
        let mut nuevo = false;
        if datos.len() as u64 > self.tam {
            self.tam = (datos.len() as u64 * 3 / 2 + 4095) & !4095;
            self.b = d.create_buffer(&wgpu::BufferDescriptor { label: Some(self.nombre), size: self.tam, usage: self.uso, mapped_at_creation: false });
            nuevo = true;
        }
        if !datos.is_empty() { q.write_buffer(&self.b, 0, &datos[..datos.len() & !3]); }
        nuevo
    }
}

pub struct Motor {
    pub device: wgpu::Device,
    pub queue: wgpu::Queue,
    pub op: Opciones,
    mallas: HashMap<i64, MallaW>,
    mats: HashMap<i64, Mat>,
    texs: HashMap<i64, TexW>,
    lms: HashMap<i64, TexW>,
    agua: Option<Agua>, agua_n: Option<TexW>, agua_p: Option<TexW>,
    cielo: Option<Cielo>, cubo: Option<TexW>,
    blanca: TexW, cubo0: TexW, prof0: TexW,
    s_rep: wgpu::Sampler, s_cla: wgpu::Sampler, s_cmp: wgpu::Sampler,
    capas: Capas, tubos: Tubos, finales: HashMap<wgpu::TextureFormat, wgpu::RenderPipeline>,
    b_glob: Buf, b_obj: Buf, b_inst: Buf, b_hue: Buf, b_part: Buf, b_partu: Buf, b_post: Buf, b_marcas: Buf, ceros: Buf,
    g_glob: Option<wgpu::BindGroup>, g_glob_solo: wgpu::BindGroup, g_obj: Option<wgpu::BindGroup>, g_hue: Option<wgpu::BindGroup>,
    g_mat: HashMap<ClaveMat, wgpu::BindGroup>,
    sombra: Option<TexW>, sombra_px: u32,
    reflejo: Option<Rt>, escena_rt: Option<Rt>, ao_rt: Option<Color1>, refr: Option<Color1>,
    marcas_n: u32,
    svp: M4,
    sesgo: [f32; 2],
    /// el cuadro (sin sus cosas, que van en `items`)
    pub c: Option<Cuadro>,
    items: Vec<ItemDin>,
    pub cuadro: u64,
    pub dibujos: u32,
    opacos: Vec<usize>, transp: Vec<usize>, aguas: Vec<usize>,
    /// lo que ocupa en la placa (mallas, texturas y luces horneadas), en bytes
    pub memoria: usize,
    /// los lugares fijos de las cosas (cuadros JXC2)
    pub ranuras: Vec<Option<ItemDin>>,
    /// dibujar con instancias las copias de una misma cosa (JXM_SIN_INST para comparar)
    pub instancias: bool,
    dbg: bool, sin_agua: bool,
    pub mapa: String,
    /// la placa que tocó (para el estado)
    pub placa: String,
}

use wgpu::{VertexAttribute as VA, VertexFormat as VF};
const A_MALLA: [VA; 3] = [VA { format: VF::Unorm16x4, offset: 0, shader_location: 0 }, VA { format: VF::Snorm8x4, offset: 8, shader_location: 1 }, VA { format: VF::Float16x2, offset: 12, shader_location: 2 }];
const A_POS: [VA; 1] = [VA { format: VF::Unorm16x4, offset: 0, shader_location: 0 }];
const A_LM: [VA; 1] = [VA { format: VF::Unorm16x2, offset: 0, shader_location: 5 }];
const A_INST: [VA; 4] = [VA { format: VF::Float32x4, offset: 0, shader_location: 6 }, VA { format: VF::Float32x4, offset: 16, shader_location: 7 }, VA { format: VF::Float32x4, offset: 32, shader_location: 8 }, VA { format: VF::Float32x4, offset: 48, shader_location: 9 }];
const A_PIEL: [VA; 2] = [VA { format: VF::Uint8x4, offset: 0, shader_location: 3 }, VA { format: VF::Unorm8x4, offset: 4, shader_location: 4 }];
const A_PART: [VA; 5] = [VA { format: VF::Float32x3, offset: 0, shader_location: 0 }, VA { format: VF::Float32x4, offset: 12, shader_location: 1 }, VA { format: VF::Float32x3, offset: 28, shader_location: 2 }, VA { format: VF::Float32x3, offset: 40, shader_location: 3 }, VA { format: VF::Float32x3, offset: 52, shader_location: 4 }];
const A_LIN: [VA; 2] = [VA { format: VF::Float32x3, offset: 0, shader_location: 0 }, VA { format: VF::Float32x4, offset: 12, shader_location: 1 }];
fn ent<'a>(n: u32, v: &'a wgpu::TextureView) -> wgpu::BindGroupEntry<'a> { wgpu::BindGroupEntry { binding: n, resource: wgpu::BindingResource::TextureView(v) } }
fn f32b(v: &[f32]) -> &[u8] { bytemuck::cast_slice(v) }
fn tamu(n: u64) -> Option<NonZeroU64> { NonZeroU64::new(n) }

impl Motor {
    /// arma los sombreadores, las tuberías y los búferes; los recursos llegan después con `cargar`
    pub fn nuevo(device: wgpu::Device, queue: wgpu::Queue, op: Opciones, placa: String) -> Result<Motor, String> {
        let d = &device;
        use wgpu::{BindGroupLayoutEntry as E, BindingType as B, ShaderStages as S};
        let unif = |n: u32, vis: S, tam: u64| E { binding: n, visibility: vis, ty: B::Buffer { ty: wgpu::BufferBindingType::Uniform, has_dynamic_offset: true, min_binding_size: tamu(tam) }, count: None };
        let tex = |n: u32, dim: wgpu::TextureViewDimension| E { binding: n, visibility: S::FRAGMENT, ty: B::Texture { sample_type: wgpu::TextureSampleType::Float { filterable: true }, view_dimension: dim, multisampled: false }, count: None };
        let texp = |n: u32| E { binding: n, visibility: S::FRAGMENT, ty: B::Texture { sample_type: wgpu::TextureSampleType::Depth, view_dimension: wgpu::TextureViewDimension::D2, multisampled: false }, count: None };
        let samp = |n: u32, t: wgpu::SamplerBindingType| E { binding: n, visibility: S::FRAGMENT, ty: B::Sampler(t), count: None };
        let capa = |n: &str, e: &[E]| d.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor { label: Some(n), entries: e });
        let d2 = wgpu::TextureViewDimension::D2; let fil = wgpu::SamplerBindingType::Filtering;
        let capas = Capas {
            glob: capa("glob", &[unif(0, S::VERTEX_FRAGMENT, G_TAM), texp(1), samp(2, wgpu::SamplerBindingType::Comparison)]),
            glob_solo: capa("glob_solo", &[unif(0, S::VERTEX_FRAGMENT, G_TAM)]),
            obj: capa("obj", &[unif(0, S::VERTEX_FRAGMENT, O_TAM)]),
            mat: capa("mat", &[tex(0, d2), tex(1, d2), tex(2, d2), tex(3, d2), tex(4, d2), samp(5, fil), samp(6, fil)]),
            hue: capa("hue", &[unif(0, S::VERTEX, H_TAM)]),
            agua: capa("agua", &[tex(0, d2), tex(1, d2), tex(2, d2), tex(3, d2), texp(4), samp(5, fil), samp(6, fil)]),
            cielo: capa("cielo", &[tex(0, wgpu::TextureViewDimension::Cube), samp(1, fil)]),
            ao: capa("ao", &[texp(0)]),
            tex1: capa("tex1", &[tex(0, d2), samp(1, fil), unif(2, S::VERTEX_FRAGMENT, U_TAM)]),
        };
        let modulo = |n: &str, partes: &[&str]| d.create_shader_module(wgpu::ShaderModuleDescriptor { label: Some(n), source: wgpu::ShaderSource::Wgsl(partes.concat().into()) });
        let m_luz = modulo("luz", &[wgsl::COMUN, wgsl::GV, wgsl::LUZ]);
        let m_som = modulo("sombra", &[wgsl::COMUN, wgsl::GV, wgsl::SOMBRA]);
        let m_agua = modulo("agua", &[wgsl::COMUN, wgsl::GV, wgsl::AGUA]);
        let m_cielo = modulo("cielo", &[wgsl::COMUN, wgsl::GV, wgsl::CIELO]);
        let m_ao = modulo("ao", &[wgsl::COMUN, wgsl::GV, wgsl::AO]);
        let m_post = modulo("post", &[wgsl::COMUN, wgsl::POST]);
        let m_part = modulo("part", &[wgsl::COMUN, wgsl::GV, wgsl::PART]);
        let m_lin = modulo("lin", &[wgsl::COMUN, wgsl::GV, wgsl::LIN]);
        let pl = |n: &str, c: &[Option<&wgpu::BindGroupLayout>]| d.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor { label: Some(n), bind_group_layouts: c, immediate_size: 0 });
        let pl_luz = pl("luz", &[Some(&capas.glob), Some(&capas.obj), Some(&capas.mat)]);
        let pl_luz_piel = pl("luz_piel", &[Some(&capas.glob), Some(&capas.obj), Some(&capas.mat), Some(&capas.hue)]);
        let pl_som = pl("sombra", &[Some(&capas.glob_solo), Some(&capas.obj)]);
        let pl_som_piel = pl("sombra_piel", &[Some(&capas.glob_solo), Some(&capas.obj), None, Some(&capas.hue)]);
        let pl_agua = pl("agua", &[Some(&capas.glob), Some(&capas.obj), Some(&capas.agua)]);
        let pl_cielo = pl("cielo", &[Some(&capas.glob_solo), Some(&capas.cielo)]);
        let pl_ao = pl("ao", &[Some(&capas.glob_solo), Some(&capas.ao)]);
        let pl_post = pl("post", &[Some(&capas.tex1)]);
        let pl_part = pl("part", &[Some(&capas.glob_solo), Some(&capas.tex1)]);
        let pl_lin = pl("lin", &[Some(&capas.glob_solo)]);

        let vb = |paso: u64, inst: bool, at: &'static [wgpu::VertexAttribute]| -> wgpu::VertexBufferLayout<'static> { wgpu::VertexBufferLayout { array_stride: paso, step_mode: if inst { wgpu::VertexStepMode::Instance } else { wgpu::VertexStepMode::Vertex }, attributes: at } };
        let (a_malla, a_pos, a_lm, a_inst, a_piel, a_part, a_lin) = (&A_MALLA[..], &A_POS[..], &A_LM[..], &A_INST[..], &A_PIEL[..], &A_PART[..], &A_LIN[..]);
        let v_luz = [Some(vb(16, false, a_malla)), Some(vb(4, false, a_lm)), Some(vb(64, true, a_inst))];
        let v_luz_piel = [Some(vb(16, false, a_malla)), Some(vb(4, false, a_lm)), Some(vb(64, true, a_inst)), Some(vb(8, false, a_piel))];
        let v_som = [Some(vb(16, false, a_pos)), Some(vb(64, true, a_inst))];
        let v_som_piel = [Some(vb(16, false, a_pos)), Some(vb(64, true, a_inst)), Some(vb(8, false, a_piel))];
        let v_part = [Some(vb(64, true, a_part))];
        let v_lin = [Some(vb(28, false, a_lin))];

        use wgpu::{BlendComponent as BC, BlendFactor as BF, BlendOperation as BO};
        let alfa = wgpu::BlendState { color: BC { src_factor: BF::SrcAlpha, dst_factor: BF::OneMinusSrcAlpha, operation: BO::Add }, alpha: BC { src_factor: BF::SrcAlpha, dst_factor: BF::OneMinusSrcAlpha, operation: BO::Add } };
        let suma = wgpu::BlendState { color: BC { src_factor: BF::SrcAlpha, dst_factor: BF::One, operation: BO::Add }, alpha: BC { src_factor: BF::SrcAlpha, dst_factor: BF::One, operation: BO::Add } };
        let mult = wgpu::BlendState { color: BC { src_factor: BF::Zero, dst_factor: BF::Src, operation: BO::Add }, alpha: BC { src_factor: BF::Zero, dst_factor: BF::One, operation: BO::Add } };
        let prof = |escribe: bool, comp: wgpu::CompareFunction, sesgo: (i32, f32)| Some(wgpu::DepthStencilState { format: FMT_P, depth_write_enabled: Some(escribe), depth_compare: Some(comp), stencil: Default::default(), bias: wgpu::DepthBiasState { constant: sesgo.0, slope_scale: sesgo.1, clamp: 0.0 } });
        let le = wgpu::CompareFunction::LessEqual;
        let tubo = |n: &str, lay: &wgpu::PipelineLayout, m: &wgpu::ShaderModule, vs: &str, bufs: &[Option<wgpu::VertexBufferLayout>], fs: Option<&str>, mezcla: Option<wgpu::BlendState>, ds: Option<wgpu::DepthStencilState>, fmt: wgpu::TextureFormat| {
            let tg = [Some(wgpu::ColorTargetState { format: fmt, blend: mezcla, write_mask: wgpu::ColorWrites::ALL })];
            d.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
                label: Some(n), layout: Some(lay),
                vertex: wgpu::VertexState { module: m, entry_point: Some(vs), compilation_options: Default::default(), buffers: bufs },
                primitive: wgpu::PrimitiveState { topology: wgpu::PrimitiveTopology::TriangleList, cull_mode: None, ..Default::default() },
                depth_stencil: ds, multisample: Default::default(),
                fragment: fs.map(|f| wgpu::FragmentState { module: m, entry_point: Some(f), compilation_options: Default::default(), targets: &tg }),
                multiview_mask: None, cache: None,
            })
        };
        // (lo de luz: opaco, transparente y que suma; con huesos o sin)
        let luz: Vec<_> = [(None, true), (Some(alfa), false), (Some(suma), false)].iter().map(|&(m, w)| tubo("luz", &pl_luz, &m_luz, "vs_luz", &v_luz, Some("fs_luz"), m, prof(w, le, (0, 0.0)), FMT)).collect();
        let luz_piel: Vec<_> = [(None, true), (Some(alfa), false), (Some(suma), false)].iter().map(|&(m, w)| tubo("luz_piel", &pl_luz_piel, &m_luz, "vs_luz_piel", &v_luz_piel, Some("fs_luz"), m, prof(w, le, (0, 0.0)), FMT)).collect();
        // (la sombra: sólo profundidad, corrida un poco —como glPolygonOffset(1.5, 3)—)
        let sombra = tubo("sombra", &pl_som, &m_som, "vs_sombra", &v_som, None, None, prof(true, le, (3, 1.5)), FMT);
        let sombra_piel = tubo("sombra_piel", &pl_som_piel, &m_som, "vs_sombra_piel", &v_som_piel, None, None, prof(true, le, (3, 1.5)), FMT);
        let agua = tubo("agua", &pl_agua, &m_agua, "vs_agua", &v_som, Some("fs_agua"), Some(alfa), prof(false, le, (0, 0.0)), FMT);
        let cielo = tubo("cielo", &pl_cielo, &m_cielo, "vs_cielo", &[], Some("fs_cielo"), None, prof(false, le, (0, 0.0)), FMT);
        let ao = tubo("ao", &pl_ao, &m_ao, "vs_pantalla", &[], Some("fs_ao"), None, None, FMT);
        let ao_poner = tubo("ao_poner", &pl_post, &m_post, "vs_pantalla", &[], Some("fs_ao_poner"), Some(mult), prof(false, wgpu::CompareFunction::Always, (0, 0.0)), FMT);
        let part: Vec<_> = [alfa, suma].iter().map(|&m| tubo("part", &pl_part, &m_part, "vs_part", &v_part, Some("fs_part"), Some(m), prof(false, le, (0, 0.0)), FMT)).collect();
        let lin = tubo("lin", &pl_lin, &m_lin, "vs_lin", &v_lin, Some("fs_lin"), Some(alfa), prof(false, le, (-4, -2.0)), FMT);
        let tubos = Tubos { luz, luz_piel, sombra, sombra_piel, agua, cielo, ao, ao_poner, part, lin, post: m_post, pl_post };

        let muestra = |rep: bool, mips: bool, cmp: bool| {
            let am = if rep { wgpu::AddressMode::Repeat } else { wgpu::AddressMode::ClampToEdge };
            d.create_sampler(&wgpu::SamplerDescriptor { address_mode_u: am, address_mode_v: am, address_mode_w: am, mag_filter: wgpu::FilterMode::Linear, min_filter: wgpu::FilterMode::Linear,
                mipmap_filter: if mips { wgpu::MipmapFilterMode::Linear } else { wgpu::MipmapFilterMode::Nearest }, compare: if cmp { Some(wgpu::CompareFunction::LessEqual) } else { None }, ..Default::default() })
        };
        let (s_rep, s_cla, s_cmp) = (muestra(true, true, false), muestra(false, false, false), muestra(false, false, true));
        use wgpu::BufferUsages as U;
        let b_glob = Buf::nuevo(d, "glob", G_PASO * 3, U::UNIFORM);
        let b_partu = Buf::nuevo(d, "partu", U_PASO * 2, U::UNIFORM);
        let b_post = Buf::nuevo(d, "post", U_PASO * 2, U::UNIFORM);
        let g_glob_solo = d.create_bind_group(&wgpu::BindGroupDescriptor { label: Some("glob_solo"), layout: &capas.glob_solo, entries: &[wgpu::BindGroupEntry { binding: 0, resource: wgpu::BindingResource::Buffer(wgpu::BufferBinding { buffer: &b_glob.b, offset: 0, size: tamu(G_TAM) }) }] });
        let mut m = Motor {
            blanca: textura(d, &queue, 1, 1, &[255, 255, 255, 255], false), cubo0: { let u = [255u8; 4]; cubo(d, &queue, 1, &[&u, &u, &u, &u, &u, &u]) }, prof0: prof_tex(d, 1, 1),
            device: device.clone(), queue: queue.clone(), op, mallas: HashMap::new(), mats: HashMap::new(), texs: HashMap::new(), lms: HashMap::new(), agua: None, agua_n: None, agua_p: None, cielo: None, cubo: None,
            s_rep, s_cla, s_cmp, capas, tubos, finales: HashMap::new(),
            b_obj: Buf::nuevo(d, "obj", 65536, U::UNIFORM), b_inst: Buf::nuevo(d, "inst", 65536, U::VERTEX), b_hue: Buf::nuevo(d, "hue", 65536, U::UNIFORM),
            b_part: Buf::nuevo(d, "part", 65536, U::VERTEX), b_marcas: Buf::nuevo(d, "marcas", 4096, U::VERTEX), ceros: Buf::nuevo(d, "ceros", 4096, U::VERTEX),
            b_glob, b_partu, b_post, g_glob: None, g_glob_solo, g_obj: None, g_hue: None, g_mat: HashMap::new(),
            sombra: None, sombra_px: 0, reflejo: None, escena_rt: None, ao_rt: None, refr: None, marcas_n: 0, svp: mat::id(), sesgo: [0.0, 0.0],
            c: None, items: vec![], cuadro: 0, dibujos: 0, opacos: vec![], transp: vec![], aguas: vec![], memoria: 0, ranuras: Vec::new(),
            instancias: std::env::var("JXM_SIN_INST").is_err(), dbg: std::env::var("JXM_DBG").is_ok(), sin_agua: std::env::var("JXM_SIN_AGUA").is_ok(), mapa: String::new(), placa,
        };
        m.g_obj = Some(m.grupo_unif(&m.capas.obj, &m.b_obj.b, O_TAM));
        m.g_hue = Some(m.grupo_unif(&m.capas.hue, &m.b_hue.b, H_TAM));
        Ok(m)
    }

    fn grupo_unif(&self, capa: &wgpu::BindGroupLayout, b: &wgpu::Buffer, tam: u64) -> wgpu::BindGroup {
        self.device.create_bind_group(&wgpu::BindGroupDescriptor { label: None, layout: capa, entries: &[wgpu::BindGroupEntry { binding: 0, resource: wgpu::BindingResource::Buffer(wgpu::BufferBinding { buffer: b, offset: 0, size: tamu(tam) }) }] })
    }
    fn grupo_glob(&self) -> wgpu::BindGroup {
        let sv = self.sombra.as_ref().map(|s| &s.v).unwrap_or(&self.prof0.v);
        self.device.create_bind_group(&wgpu::BindGroupDescriptor { label: Some("glob"), layout: &self.capas.glob, entries: &[
            wgpu::BindGroupEntry { binding: 0, resource: wgpu::BindingResource::Buffer(wgpu::BufferBinding { buffer: &self.b_glob.b, offset: 0, size: tamu(G_TAM) }) },
            wgpu::BindGroupEntry { binding: 1, resource: wgpu::BindingResource::TextureView(sv) },
            wgpu::BindGroupEntry { binding: 2, resource: wgpu::BindingResource::Sampler(&self.s_cmp) },
        ] })
    }
    fn grupo_tex1(&self, v: &wgpu::TextureView, s: &wgpu::Sampler, b: &wgpu::Buffer) -> wgpu::BindGroup {
        self.device.create_bind_group(&wgpu::BindGroupDescriptor { label: None, layout: &self.capas.tex1, entries: &[
            wgpu::BindGroupEntry { binding: 0, resource: wgpu::BindingResource::TextureView(v) },
            wgpu::BindGroupEntry { binding: 1, resource: wgpu::BindingResource::Sampler(s) },
            wgpu::BindGroupEntry { binding: 2, resource: wgpu::BindingResource::Buffer(wgpu::BufferBinding { buffer: b, offset: 0, size: tamu(U_TAM) }) },
        ] })
    }

    /// sube a la placa los recursos nuevos (los que ya estaban con el mismo número se reemplazan)
    pub fn cargar(&mut self, esc: &Escena) -> Result<(), String> {
        let (d, q) = (&self.device, &self.queue);
        let rango = |o: usize, n: usize| -> Result<&[u8], String> { esc.datos.get(o..o + n).ok_or_else(|| format!("bloque fuera del archivo ({o}+{n} de {})", esc.datos.len())) };
        use wgpu::util::DeviceExt;
        let buf = |n: &str, datos: &[u8], uso: wgpu::BufferUsages| {
            // (los búferes de la placa van de a 4 bytes)
            let mut v = datos.to_vec(); while v.len() % 4 != 0 { v.push(0); }
            d.create_buffer_init(&wgpu::util::BufferInitDescriptor { label: Some(n), contents: &v, usage: uso })
        };
        let mut max_v = 0u64;
        for m in &esc.c.mallas {
            // (los vértices vienen de a 14 bytes —posición u16×3, normal i8×4, uv f16×2—; la placa los quiere de a 4: 16)
            let src = rango(m.vo, m.v as usize * 14)?; let mut vv = vec![0u8; m.v as usize * 16];
            for (i, c) in src.chunks_exact(14).enumerate() { let o = i * 16; vv[o..o + 6].copy_from_slice(&c[0..6]); vv[o + 8..o + 16].copy_from_slice(&c[6..14]); }
            let vb = buf("vert", &vv, wgpu::BufferUsages::VERTEX);
            let ib = buf("ind", rango(m.io, m.ni as usize * if m.i32 != 0 { 4 } else { 2 })?, wgpu::BufferUsages::INDEX);
            let lm = if m.lo >= 0 { Some(buf("lm", rango(m.lo as usize, m.v as usize * 4)?, wgpu::BufferUsages::VERTEX)) } else { max_v = max_v.max(m.v as u64); None };
            let piel = if m.so >= 0 { Some(buf("piel", rango(m.so as usize, m.v as usize * 8)?, wgpu::BufferUsages::VERTEX)) } else { None };
            let bytes = vv.len() + m.ni as usize * if m.i32 != 0 { 4 } else { 2 } + if m.lo >= 0 { m.v as usize * 4 } else { 0 } + if m.so >= 0 { m.v as usize * 8 } else { 0 };
            if let Some(v) = self.mallas.insert(m.id, MallaW { vb, ib, lm, piel, i32: m.i32 != 0, mn: m.mn, sc: m.sc, lm_id: m.lm, v: m.v, bytes }) { self.memoria -= v.bytes; }
            self.memoria += bytes;
        }
        // (las mallas sin luz horneada leen ceros: un búfer compartido con lugar para la más grande)
        if max_v * 4 > self.ceros.tam { self.ceros = Buf::nuevo(d, "ceros", max_v * 4 + 4096, wgpu::BufferUsages::VERTEX); }   // (wgpu los crea en cero)
        let mut cambio_tex = false;
        for t in &esc.c.texs {
            let n = (t.w * t.h * 4) as usize; let tx = textura(d, q, t.w, t.h, rango(t.o, n)?, true);
            self.memoria += tx.bytes; cambio_tex = true;
            if let Some(v) = self.texs.insert(t.id, tx) { self.memoria -= v.bytes; }
        }
        for t in &esc.c.lms {
            let n = (t.w * t.h * 4) as usize; let tx = textura(d, q, t.w, t.h, rango(t.o, n)?, false);
            self.memoria += tx.bytes; cambio_tex = true;
            if let Some(v) = self.lms.insert(t.id, tx) { self.memoria -= v.bytes; }
        }
        if cambio_tex { self.g_mat.clear(); }
        for m in &esc.c.mats { self.mats.insert(m.id, m.clone()); }
        if let Some(a) = &esc.c.agua {
            if let Some(n) = &a.normal { self.agua_n = Some(textura(d, q, n.w, n.h, rango(n.o, (n.w * n.h * 4) as usize)?, true)); }
            if let Some(p) = a.prof.as_ref().and_then(|p| p.tex.as_ref()) { self.agua_p = Some(textura(d, q, p.w, p.h, rango(p.o, (p.w * p.h * 4) as usize)?, false)); }
            self.agua = Some(a.clone());
        }
        if let Some(c) = &esc.c.cielo {
            if let Some(cr) = &c.caras {
                let n = (cr.l * cr.l * 4) as usize; let mut caras = vec![];
                for &o in cr.o.iter().take(6) { caras.push(rango(o, n)?); }
                if caras.len() == 6 { self.cubo = Some(cubo(d, q, cr.l, &caras)); }
            }
            let mut c2 = c.clone(); c2.caras = None; self.cielo = Some(c2);
        }
        if !esc.c.mapa.is_empty() { self.mapa = esc.c.mapa.clone(); }
        Ok(())
    }

    /// borra todo lo cargado (cambio de mapa)
    pub fn vaciar(&mut self) {
        self.mallas.clear(); self.texs.clear(); self.lms.clear(); self.g_mat.clear();
        self.agua_n = None; self.agua_p = None; self.cubo = None; self.cielo = None;
        self.mats.clear(); self.agua = None; self.memoria = 0; self.c = None; self.items.clear(); self.ranuras.clear();
    }
    /// borra recursos sueltos: tipo 0 mallas, 1 texturas, 2 luces horneadas, 3 materiales
    pub fn quitar(&mut self, tipo: u8, ids: &[i64]) {
        for id in ids {
            match tipo {
                0 => if let Some(m) = self.mallas.remove(id) { self.memoria -= m.bytes; },
                1 => if let Some(t) = self.texs.remove(id) { self.memoria -= t.bytes; },
                2 => if let Some(t) = self.lms.remove(id) { self.memoria -= t.bytes; },
                _ => { self.mats.remove(id); }
            }
        }
        if tipo == 1 || tipo == 2 { self.g_mat.clear(); }
    }
    pub fn tiene_malla(&self, id: i64) -> bool { self.mallas.contains_key(&id) }

    /// el cuadro que sigue: qué se ve (recorte por la cámara) y en qué pasada va cada cosa
    pub fn poner_cuadro(&mut self, mut c: Cuadro) {
        let pl = mat::planos(&c.vp);
        self.items = std::mem::take(&mut c.items);
        self.opacos.clear(); self.transp.clear(); self.aguas.clear();
        for (i, it) in self.items.iter().enumerate() {
            let (Some(_), Some(mt)) = (self.mallas.get(&it.m), self.mats.get(&it.mat)) else { continue };
            if !mat::esfera_dentro(&pl, &it.esf) { continue; }
            if mt.agua != 0 { self.aguas.push(i) } else if mt.blend != 0 || mt.add != 0 { self.transp.push(i) } else { self.opacos.push(i) }
        }
        if self.dbg {
            let fuera = self.items.iter().filter(|it| !mat::esfera_dentro(&pl, &it.esf)).count();
            eprintln!("cuadro (wgpu): {} cosas · fuera de cámara {}", self.items.len(), fuera);
        }
        let (mallas, mats, items) = (&self.mallas, &self.mats, &self.items);
        let clave = |it: &ItemDin| (!it.h.is_empty() && mallas[&it.m].piel.is_some(), mats[&it.mat].t, it.m, it.s0, it.mat);
        self.opacos.sort_by_key(|&i| clave(&items[i]));
        // (las marcas de frenada llegan sólo cuando cambian: quedan en su búfer)
        if let Some((_, d)) = c.efectos.iter().find(|e| e.0 == EF_MARCAS) {
            self.b_marcas.subir(&self.device, &self.queue, f32b(d)); self.marcas_n = (d.len() / 7) as u32;
        }
        // (lo transparente: de lo más lejos a lo más cerca)
        let d2 = |it: &ItemDin| { let e = it.esf; let (x, y, z) = (e[0] - c.pos[0], e[1] - c.pos[1], e[2] - c.pos[2]); x * x + y * y + z * z };
        self.transp.sort_by(|&a, &b| d2(&items[b]).partial_cmp(&d2(&items[a])).unwrap_or(std::cmp::Ordering::Equal));
        self.c = Some(c);
    }

    fn sol(&self) -> [f32; 3] { mat::norm(self.c.as_ref().map(|c| c.luz.sol).unwrap_or([0.3, 0.8, 0.2])) }

    /// la cabecera de una pasada: cámara (vp), recorte, y lo del cuadro (sol, cielo, niebla, sombra y luces)
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
    }

    /// las texturas de un material con la luz horneada de su malla, y su modo
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
    /// el registro de una malla con su material (una vez por cuadro por pareja); para la sombra, sólo la malla
    fn reg_obj(&self, a: &mut Arm, it: &ItemDin, sombra: bool) -> u32 {
        let k = (it.m, if sombra { i64::MIN } else { it.mat }, 0);
        if let Some(&o) = a.porobj.get(&k) { return o; }
        let m = &self.mallas[&it.m]; let o = (a.obj.len() / 64) as u32 * O_PASO as u32;
        let mut r = [0f32; 64];
        r[0..3].copy_from_slice(&m.mn); r[4..7].copy_from_slice(&m.sc);
        if !sombra {
            let mt = &self.mats[&it.mat]; let (_, modo) = self.clave_mat(it);
            r[8..12].copy_from_slice(&mt.st); r[12..16].copy_from_slice(&mt.c); r[16..19].copy_from_slice(&mt.em); r[20..23].copy_from_slice(&mt.pbr);
            if let Some(tr) = mt.terr.as_ref().filter(|t| t.len() == 3) { r[24..28].copy_from_slice(&[tr[0].1, tr[0].2, tr[1].1, tr[1].2]); r[28] = tr[2].1; r[29] = tr[2].2; }
            r[30] = modo;
        }
        a.obj.extend_from_slice(&r); a.porobj.insert(k, o); o
    }
    /// los huesos de un personaje (iguales en todas sus partes: se suben una vez)
    fn reg_hue(a: &mut Arm, h: &[f32]) -> u32 {
        let n = h.len().min(MAX_HUESOS * 12);
        let mut x: u64 = 0xcbf29ce484222325; for v in &h[..n] { x = (x ^ v.to_bits() as u64).wrapping_mul(0x100000001b3); }
        if let Some(&o) = a.porhue.get(&x) { return o; }
        let o = (a.hue.len() * 4) as u32; let paso = (H_PASO / 4) as usize;
        let ini = a.hue.len(); a.hue.resize(ini + paso, 0.0); a.hue[ini..ini + n].copy_from_slice(&h[..n]);
        a.porhue.insert(x, o); o
    }
    /// la lista de dibujos de lo opaco (con la luz o para la sombra): las copias de una misma cosa sin huesos, juntas
    fn lista(&self, a: &mut Arm, lista: &[usize], sombra: bool) -> Vec<Dib> {
        let mismo = |x: &ItemDin, y: &ItemDin| x.m == y.m && x.s0 == y.s0 && x.sn == y.sn && (sombra || x.mat == y.mat) && x.h.is_empty() && y.h.is_empty();
        let mut v = vec![]; let mut k = 0;
        while k < lista.len() {
            let it = &self.items[lista[k]]; let mut e = k + 1;
            while self.instancias && e < lista.len() && mismo(it, &self.items[lista[e]]) { e += 1; }
            let piel = !it.h.is_empty() && self.mallas[&it.m].piel.is_some();
            let inst = (a.inst.len() * 4) as u64;
            for &i in &lista[k..e] { a.inst.extend_from_slice(&self.items[i].mm); }
            let obj = self.reg_obj(a, it, sombra);
            let hue = if piel { Some(Self::reg_hue(a, &it.h)) } else { None };
            let mk = if sombra { [i64::MIN; 5] } else { let (mk, _) = self.clave_mat(it); a.claves.push(mk); mk };
            v.push(Dib { m: it.m, s0: it.s0, sn: it.sn, obj, inst, n: (e - k) as u32, hue, mk, mezcla: 0, piel });
            k = e;
        }
        v
    }

    /// lo opaco que se ve con otra matriz (el reflejo, la sombra)
    fn recortar(&self, vp: &M4, sombra: bool) -> Vec<usize> {
        let pl = mat::planos(vp);
        let mut v: Vec<usize> = self.items.iter().enumerate().filter(|(_, it)| {
            let (Some(_), Some(mt)) = (self.mallas.get(&it.m), self.mats.get(&it.mat)) else { return false };
            mt.agua == 0 && mt.blend == 0 && mt.add == 0 && !(sombra && it.fl & FL_SIN_SOMBRA != 0) && mat::esfera_dentro(&pl, &it.esf)
        }).map(|(i, _)| i).collect();
        v.sort_by_key(|&i| { let it = &self.items[i]; (!it.h.is_empty() && self.mallas[&it.m].piel.is_some(), self.mats[&it.mat].t, it.m, it.s0, it.mat) });
        v
    }

    fn tex_v(&self, id: i64) -> &wgpu::TextureView { if id == i64::MIN { &self.blanca.v } else { self.texs.get(&id).map(|t| &t.v).unwrap_or(&self.blanca.v) } }
    fn grupos_mat(&mut self, claves: &[ClaveMat]) {
        for k in claves {
            if self.g_mat.contains_key(k) { continue; }
            let lm = if k[4] == i64::MIN { &self.blanca.v } else { self.lms.get(&k[4]).map(|t| &t.v).unwrap_or(&self.blanca.v) };
            let e = ent;
            let g = self.device.create_bind_group(&wgpu::BindGroupDescriptor { label: Some("mat"), layout: &self.capas.mat, entries: &[
                e(0, self.tex_v(k[0])), e(1, self.tex_v(k[1])), e(2, self.tex_v(k[2])), e(3, self.tex_v(k[3])), e(4, lm),
                wgpu::BindGroupEntry { binding: 5, resource: wgpu::BindingResource::Sampler(&self.s_rep) }, wgpu::BindGroupEntry { binding: 6, resource: wgpu::BindingResource::Sampler(&self.s_cla) },
            ] });
            self.g_mat.insert(*k, g);
        }
    }

    /// la sombra del sol: la matriz (ortográfica alrededor de la cámara, en pasos de un píxel para que no tiemble)
    fn matriz_sombra(&mut self) {
        let px = self.op.sombra_px as f32; let c = self.c.as_ref().unwrap().pos; let s = self.sol(); let r = self.op.sombra_radio;
        let paso = 2.0 * r / px; let cen = [(c[0] / paso).round() * paso, (c[1] / paso).round() * paso, (c[2] / paso).round() * paso];
        let alto = r + 80.0; let rango = alto + r;
        let ojo = [cen[0] + s[0] * alto, cen[1] + s[1] * alto, cen[2] + s[2] * alto];
        let arriba = if s[1].abs() > 0.95 { [0.0, 0.0, 1.0] } else { [0.0, 1.0, 0.0] };
        self.svp = mat::mul(&mat::orto(-r, r, -r, r, 0.5, rango), &mat::mirar(ojo, cen, arriba));
        self.sesgo = [0.04 / rango, 1.5 * paso];
    }

    /// la tubería de la imagen final para el formato de la salida
    fn final_para(&mut self, f: wgpu::TextureFormat) {
        if self.finales.contains_key(&f) { return; }
        let tg = [Some(wgpu::ColorTargetState { format: f, blend: None, write_mask: wgpu::ColorWrites::ALL })];
        let p = self.device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("final"), layout: Some(&self.tubos.pl_post),
            vertex: wgpu::VertexState { module: &self.tubos.post, entry_point: Some("vs_pantalla"), compilation_options: Default::default(), buffers: &[] },
            primitive: Default::default(), depth_stencil: None, multisample: Default::default(),
            fragment: Some(wgpu::FragmentState { module: &self.tubos.post, entry_point: Some("fs_final"), compilation_options: Default::default(), targets: &tg }),
            multiview_mask: None, cache: None,
        });
        self.finales.insert(f, p);
    }

    /// un cuadro entero en `salida` (w × h, del formato `formato`)
    pub fn dibujar(&mut self, salida: &wgpu::TextureView, formato: wgpu::TextureFormat, w: u32, h: u32) {
        self.dibujos = 0;
        self.final_para(formato);
        let mut enc = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor { label: Some("cuadro") });
        if self.c.is_none() {
            let _ = enc.begin_render_pass(&wgpu::RenderPassDescriptor { label: None, color_attachments: &[Some(wgpu::RenderPassColorAttachment { view: salida, depth_slice: None, resolve_target: None, ops: wgpu::Operations { load: wgpu::LoadOp::Clear(wgpu::Color::BLACK), store: wgpu::StoreOp::Store } })], depth_stencil_attachment: None, timestamp_writes: None, occlusion_query_set: None, multiview_mask: None });
            self.queue.submit(Some(enc.finish())); return;
        }
        // --- qué pasadas hay en este cuadro
        let hacer_sombra = self.op.sombras && (self.sombra.is_none() || self.cuadro % self.op.sombra_cada.max(1) as u64 == 0);
        let ay = self.c.as_ref().unwrap().agua_y.or(self.agua.as_ref().map(|a| a.y));
        let hay_agua = !self.aguas.is_empty() && self.agua.is_some() && self.agua_n.is_some() && !self.sin_agua;
        let cam_arriba = ay.map(|y| self.c.as_ref().unwrap().pos[1] > y + 0.05).unwrap_or(false);
        let hacer_ref = hay_agua && self.op.reflejo && cam_arriba && (self.reflejo.is_none() || self.cuadro % self.op.reflejo_cada.max(1) as u64 == 0);
        let (ew, eh) = (((w as f32) * self.op.escala).round().max(16.0) as u32, ((h as f32) * self.op.escala).round().max(16.0) as u32);
        // --- los destinos
        if self.op.sombras && (self.sombra.is_none() || self.sombra_px != self.op.sombra_px as u32) {
            let px = self.op.sombra_px as u32; self.sombra = Some(prof_tex(&self.device, px, px)); self.sombra_px = px; self.g_glob = None;
        }
        if self.g_glob.is_none() { self.g_glob = Some(self.grupo_glob()); }
        if self.escena_rt.as_ref().map(|r| r.w != ew || r.h != eh).unwrap_or(true) { self.escena_rt = Some(destino(&self.device, ew, eh)); }
        let (rw, rh) = ((w / self.op.reflejo_div as u32).max(16), (h / self.op.reflejo_div as u32).max(16));
        if hacer_ref && self.reflejo.as_ref().map(|r| r.w != rw || r.h != rh).unwrap_or(true) { self.reflejo = Some(destino(&self.device, rw, rh)); }
        if self.op.ao && self.ao_rt.as_ref().map(|r| r.w != (ew / 2).max(8) || r.h != (eh / 2).max(8)).unwrap_or(true) { self.ao_rt = Some(color1(&self.device, (ew / 2).max(8), (eh / 2).max(8))); }
        if hay_agua && self.refr.as_ref().map(|r| r.w != ew || r.h != eh).unwrap_or(true) { self.refr = Some(color1(&self.device, ew, eh)); }

        // --- lo que va a la placa: cabeceras, registros, matrices y huesos
        let vp = self.c.as_ref().unwrap().vp;
        if hacer_sombra { self.matriz_sombra(); }
        let mut a = Arm::default();
        let l_som = if hacer_sombra { let l = self.recortar(&self.svp.clone(), true); self.lista(&mut a, &l, true) } else { vec![] };
        let vref = ay.map(|y| mat::mul(&vp, &mat::espejo_y(y))).unwrap_or(vp);
        let l_ref = if hacer_ref { let l = self.recortar(&vref, false); self.lista(&mut a, &l, false) } else { vec![] };
        let opacos = self.opacos.clone();
        let l_op = self.lista(&mut a, &opacos, false);
        let mut l_tr = vec![];
        for &i in &self.transp.clone() {
            let it = &self.items[i]; let piel = !it.h.is_empty() && self.mallas[&it.m].piel.is_some();
            let inst = (a.inst.len() * 4) as u64; a.inst.extend_from_slice(&it.mm);
            let obj = self.reg_obj(&mut a, it, false); let hue = if piel { Some(Self::reg_hue(&mut a, &it.h)) } else { None };
            let (mk, _) = self.clave_mat(it); a.claves.push(mk);
            l_tr.push(Dib { m: it.m, s0: it.s0, sn: it.sn, obj, inst, n: 1, hue, mk, mezcla: if self.mats[&it.mat].add != 0 { 2 } else { 1 }, piel });
        }
        // (el agua: un registro propio por cosa de agua, con lo del agua del mapa)
        let mut l_agua = vec![];
        if hay_agua {
            let ag = self.agua.as_ref().unwrap(); let refl_on = self.op.reflejo && cam_arriba && self.reflejo.is_some();
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
                l_agua.push(Dib { m: it.m, s0: it.s0, sn: it.sn, obj: o, inst, n: 1, hue: None, mk: [i64::MIN; 5], mezcla: 1, piel: false });
            }
        }
        // (las partículas: dos bloques —alfa y suma—, con la derecha y el arriba de la cámara)
        let mut l_part: Vec<(u32, u64, u32)> = vec![]; let mut part = vec![]; let mut partu = vec![0f32; (U_PASO / 4 * 2) as usize];
        if let Some(c) = &self.c {
            for (k, (t, d)) in c.efectos.iter().filter(|e| (e.0 == EF_PART_ALFA || e.0 == EF_PART_SUMA) && e.1.len() > 6).take(2).enumerate() {
                let o = k * (U_PASO / 4) as usize; partu[o..o + 3].copy_from_slice(&d[0..3]); partu[o + 4..o + 7].copy_from_slice(&d[3..6]);
                l_part.push((*t, (part.len() * 4) as u64, ((d.len() - 6) / 16) as u32)); part.extend_from_slice(&d[6..]);
            }
        }
        // (la cabecera de cada pasada)
        let mut gb = vec![0f32; (G_PASO / 4 * 3) as usize];
        let n = (G_PASO / 4) as usize;
        self.glob(&vp, -1e9, &mut gb[0..n]);
        if hacer_ref { self.glob(&vref, ay.unwrap() - 0.05, &mut gb[n..2 * n]); }
        if hacer_sombra { let svp = self.svp; self.glob(&svp, -1e9, &mut gb[2 * n..3 * n]); }
        // (poner la oclusión: el paso de las 4 muestras y la fuerza; la imagen final: el retoque y si la pantalla es sRGB)
        let (aw, ah) = self.ao_rt.as_ref().map(|r| (r.w, r.h)).unwrap_or((1, 1));
        let mut post = vec![0f32; (U_PASO / 4 * 2) as usize];
        post[0..4].copy_from_slice(&[0.75 / aw as f32, 0.75 / ah as f32, self.op.ao_fuerza, 0.0]);
        post[64..68].copy_from_slice(&[if self.op.retoque { 1.0 } else { 0.0 }, if formato.is_srgb() { 1.0 } else { 0.0 }, 0.0, 0.0]);
        // --- subir
        let (d, q) = (self.device.clone(), self.queue.clone());
        self.b_glob.subir(&d, &q, f32b(&gb));
        if self.b_obj.subir(&d, &q, f32b(&a.obj)) { self.g_obj = Some(self.grupo_unif(&self.capas.obj, &self.b_obj.b, O_TAM)); }
        if self.b_hue.subir(&d, &q, f32b(&a.hue)) { self.g_hue = Some(self.grupo_unif(&self.capas.hue, &self.b_hue.b, H_TAM)); }
        self.b_inst.subir(&d, &q, f32b(&a.inst));
        self.b_part.subir(&d, &q, f32b(&part)); self.b_partu.subir(&d, &q, f32b(&partu)); self.b_post.subir(&d, &q, f32b(&post));
        let claves = std::mem::take(&mut a.claves); self.grupos_mat(&claves);
        // (los grupos de este cuadro)
        let esc = self.escena_rt.as_ref().unwrap();
        let g_cielo = d.create_bind_group(&wgpu::BindGroupDescriptor { label: None, layout: &self.capas.cielo, entries: &[
            wgpu::BindGroupEntry { binding: 0, resource: wgpu::BindingResource::TextureView(self.cubo.as_ref().map(|c| &c.v).unwrap_or(&self.cubo0.v)) },
            wgpu::BindGroupEntry { binding: 1, resource: wgpu::BindingResource::Sampler(&self.s_cla) } ] });
        let g_ao = d.create_bind_group(&wgpu::BindGroupDescriptor { label: None, layout: &self.capas.ao, entries: &[wgpu::BindGroupEntry { binding: 0, resource: wgpu::BindingResource::TextureView(&esc.pv) }] });
        let g_aop = self.ao_rt.as_ref().map(|r| self.grupo_tex1(&r.v, &self.s_cla, &self.b_post.b));
        let g_fin = self.grupo_tex1(&esc.cv, &self.s_cla, &self.b_post.b);
        let g_part = self.grupo_tex1(self.texs.get(&TEX_ATLAS).map(|t| &t.v).unwrap_or(&self.blanca.v), &self.s_rep, &self.b_partu.b);
        let g_agua = if hay_agua {
            let e = ent;
            Some(d.create_bind_group(&wgpu::BindGroupDescriptor { label: Some("agua"), layout: &self.capas.agua, entries: &[
                e(0, &self.agua_n.as_ref().unwrap().v), e(1, self.reflejo.as_ref().map(|r| &r.cv).unwrap_or(&self.blanca.v)), e(2, self.agua_p.as_ref().map(|t| &t.v).unwrap_or(&self.blanca.v)),
                e(3, &self.refr.as_ref().unwrap().v), e(4, &esc.pv),
                wgpu::BindGroupEntry { binding: 5, resource: wgpu::BindingResource::Sampler(&self.s_rep) }, wgpu::BindGroupEntry { binding: 6, resource: wgpu::BindingResource::Sampler(&self.s_cla) } ] }))
        } else { None };

        let mut dibujos = 0u32;
        // --- la sombra
        if hacer_sombra {
            let sv = &self.sombra.as_ref().unwrap().v;
            let mut p = empezar(&mut enc, None, Some((sv, true, true)));
            p.set_bind_group(0, &self.g_glob_solo, &[G_SOM * G_PASO as u32]);
            dibujos += self.dibujar_lista(&mut p, &l_som, true);
        }
        // --- el reflejo del agua: la escena espejada en el plano del agua, a una fracción de la resolución
        if hacer_ref {
            let r = self.reflejo.as_ref().unwrap();
            let mut p = empezar(&mut enc, Some((&r.cv, true)), Some((&r.pv, true, false)));
            self.cielo(&mut p, &g_cielo, G_REF); dibujos += 1;
            p.set_bind_group(0, self.g_glob.as_ref().unwrap(), &[G_REF * G_PASO as u32]);
            dibujos += self.dibujar_lista(&mut p, &l_ref, false);
        }
        // --- la escena: cielo y lo opaco; con oclusión, la oclusión aparte y después lo demás
        let marcas = |m: &Self, p: &mut wgpu::RenderPass| -> u32 {
            if m.marcas_n == 0 { return 0; }
            p.set_pipeline(&m.tubos.lin); p.set_bind_group(0, &m.g_glob_solo, &[0]); p.set_vertex_buffer(0, m.b_marcas.b.slice(..)); p.draw(0..m.marcas_n, 0..1); 1
        };
        {
            let mut p = empezar(&mut enc, Some((&esc.cv, true)), Some((&esc.pv, true, true)));
            self.cielo(&mut p, &g_cielo, G_CAM); dibujos += 1;
            p.set_bind_group(0, self.g_glob.as_ref().unwrap(), &[0]);
            dibujos += self.dibujar_lista(&mut p, &l_op, false);
            if !self.op.ao { dibujos += marcas(self, &mut p); dibujos += self.dibujar_transp(&mut p, &l_tr); }
        }
        if self.op.ao {
            let r = self.ao_rt.as_ref().unwrap();
            {
                let mut p = empezar(&mut enc, Some((&r.v, true)), None);
                p.set_pipeline(&self.tubos.ao); p.set_bind_group(0, &self.g_glob_solo, &[0]); p.set_bind_group(1, &g_ao, &[]); p.draw(0..3, 0..1);
            }
            let mut p = empezar(&mut enc, Some((&esc.cv, false)), Some((&esc.pv, false, true)));
            p.set_pipeline(&self.tubos.ao_poner); p.set_bind_group(0, g_aop.as_ref().unwrap(), &[0]); p.draw(0..3, 0..1); dibujos += 2;
            dibujos += marcas(self, &mut p);
            p.set_bind_group(0, self.g_glob.as_ref().unwrap(), &[0]);
            dibujos += self.dibujar_transp(&mut p, &l_tr);
        }
        // --- el agua (ve a través de sí la copia de la escena) y las partículas, con la profundidad sólo para leer
        if hay_agua {
            let rf = self.refr.as_ref().unwrap();
            enc.copy_texture_to_texture(esc.color.as_image_copy(), rf.t.as_image_copy(), wgpu::Extent3d { width: ew, height: eh, depth_or_array_layers: 1 });
        }
        if hay_agua || !l_part.is_empty() {
            let mut p = empezar(&mut enc, Some((&esc.cv, false)), Some((&esc.pv, false, false)));
            if let Some(ga) = &g_agua {
                p.set_pipeline(&self.tubos.agua); p.set_bind_group(0, self.g_glob.as_ref().unwrap(), &[0]); p.set_bind_group(2, ga, &[]);
                for dd in &l_agua {
                    let m = &self.mallas[&dd.m];
                    p.set_bind_group(1, self.g_obj.as_ref().unwrap(), &[dd.obj]);
                    p.set_vertex_buffer(0, m.vb.slice(..)); p.set_vertex_buffer(1, self.b_inst.b.slice(dd.inst..dd.inst + 64));
                    p.set_index_buffer(m.ib.slice(..), if m.i32 { wgpu::IndexFormat::Uint32 } else { wgpu::IndexFormat::Uint16 });
                    p.draw_indexed(dd.s0..dd.s0 + dd.sn, 0, 0..1); dibujos += 1;
                }
            }
            for (k, &(t, off, n)) in l_part.iter().enumerate() {
                p.set_pipeline(&self.tubos.part[if t == EF_PART_SUMA { 1 } else { 0 }]);
                p.set_bind_group(0, &self.g_glob_solo, &[0]); p.set_bind_group(1, &g_part, &[k as u32 * U_PASO as u32]);
                p.set_vertex_buffer(0, self.b_part.b.slice(off..off + n as u64 * 64)); p.draw(0..6, 0..n); dibujos += 1;
            }
        }
        // --- a la pantalla, estirada, con el retoque final
        {
            let mut p = empezar(&mut enc, Some((salida, true)), None);
            p.set_pipeline(&self.finales[&formato]); p.set_bind_group(0, &g_fin, &[U_PASO as u32]); p.draw(0..3, 0..1);
        }
        self.queue.submit(Some(enc.finish()));
        self.dibujos = dibujos;
        self.cuadro += 1;
    }

    fn cielo(&self, p: &mut wgpu::RenderPass, g: &wgpu::BindGroup, glob: u32) {
        p.set_pipeline(&self.tubos.cielo); p.set_bind_group(0, &self.g_glob_solo, &[glob * G_PASO as u32]); p.set_bind_group(1, g, &[]); p.draw(0..3, 0..1);
    }
    /// dibuja una lista de lo opaco con la luz (o para la sombra), cambiando de tubería cuando cambia con/sin huesos
    fn dibujar_lista(&self, p: &mut wgpu::RenderPass, l: &[Dib], sombra: bool) -> u32 {
        let mut act: Option<bool> = None; let mut mk_act: Option<ClaveMat> = None;
        for dd in l {
            if act != Some(dd.piel) {
                act = Some(dd.piel); mk_act = None;
                p.set_pipeline(match (sombra, dd.piel) { (true, false) => &self.tubos.sombra, (true, true) => &self.tubos.sombra_piel, (false, false) => &self.tubos.luz[0], (false, true) => &self.tubos.luz_piel[0] });
            }
            self.un_dib(p, dd, sombra, &mut mk_act);
        }
        l.len() as u32
    }
    fn dibujar_transp(&self, p: &mut wgpu::RenderPass, l: &[Dib]) -> u32 {
        if l.is_empty() { return 0; }
        p.set_bind_group(0, self.g_glob.as_ref().unwrap(), &[0]);
        let mut act: Option<(bool, u8)> = None; let mut mk_act: Option<ClaveMat> = None;
        for dd in l {
            if act != Some((dd.piel, dd.mezcla)) { act = Some((dd.piel, dd.mezcla)); p.set_pipeline(if dd.piel { &self.tubos.luz_piel[dd.mezcla as usize] } else { &self.tubos.luz[dd.mezcla as usize] }); }
            self.un_dib(p, dd, false, &mut mk_act);
        }
        l.len() as u32
    }
    fn un_dib(&self, p: &mut wgpu::RenderPass, dd: &Dib, sombra: bool, mk_act: &mut Option<ClaveMat>) {
        let m = &self.mallas[&dd.m];
        p.set_bind_group(1, self.g_obj.as_ref().unwrap(), &[dd.obj]);
        if let Some(h) = dd.hue { p.set_bind_group(3, self.g_hue.as_ref().unwrap(), &[h]); }
        p.set_vertex_buffer(0, m.vb.slice(..));
        let ib = dd.inst..dd.inst + dd.n as u64 * 64;
        if sombra {
            p.set_vertex_buffer(1, self.b_inst.b.slice(ib));
            if let Some(s) = &m.piel { if dd.piel { p.set_vertex_buffer(2, s.slice(..)); } }
        } else {
            if *mk_act != Some(dd.mk) { if let Some(g) = self.g_mat.get(&dd.mk) { p.set_bind_group(2, g, &[]); } *mk_act = Some(dd.mk); }
            p.set_vertex_buffer(1, m.lm.as_ref().map(|b| b.slice(..)).unwrap_or(self.ceros.b.slice(..)));
            p.set_vertex_buffer(2, self.b_inst.b.slice(ib));
            if let Some(s) = &m.piel { if dd.piel { p.set_vertex_buffer(3, s.slice(..)); } }
        }
        p.set_index_buffer(m.ib.slice(..), if m.i32 { wgpu::IndexFormat::Uint32 } else { wgpu::IndexFormat::Uint16 });
        p.draw_indexed(dd.s0..dd.s0 + dd.sn, 0, 0..dd.n);
    }

    pub fn resumen(&self) -> String {
        let n = self.items.len();
        format!("mapa {} · {} mallas · {} texturas · {} luces horneadas · {} materiales · {:.1} MB en la placa · {} cosas en el cuadro ({} opacas, {} transparentes, {} de agua a la vista) · {}",
            self.mapa, self.mallas.len(), self.texs.len(), self.lms.len(), self.mats.len(), self.memoria as f64 / 1e6, n, self.opacos.len(), self.transp.len(), self.aguas.len(), self.placa)
    }
}

/// empieza una pasada: color (vista, limpiar) y profundidad (vista, limpiar, guardar); sin color, sólo profundidad. La
/// profundidad que no se limpia ni se guarda es sólo para leer (el agua la lee como textura en la misma pasada)
fn empezar<'e>(enc: &'e mut wgpu::CommandEncoder, color: Option<(&wgpu::TextureView, bool)>, prof: Option<(&wgpu::TextureView, bool, bool)>) -> wgpu::RenderPass<'e> {
    let ca = [color.map(|(v, limpiar)| wgpu::RenderPassColorAttachment { view: v, depth_slice: None, resolve_target: None,
        ops: wgpu::Operations { load: if limpiar { wgpu::LoadOp::Clear(wgpu::Color { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }) } else { wgpu::LoadOp::Load }, store: wgpu::StoreOp::Store } })];
    let n = color.is_some() as usize;
    enc.begin_render_pass(&wgpu::RenderPassDescriptor { label: None, color_attachments: &ca[..n],
        depth_stencil_attachment: prof.map(|(v, limpiar, guardar)| wgpu::RenderPassDepthStencilAttachment { view: v,
            depth_ops: if !limpiar && !guardar { None } else { Some(wgpu::Operations { load: if limpiar { wgpu::LoadOp::Clear(1.0) } else { wgpu::LoadOp::Load }, store: if guardar { wgpu::StoreOp::Store } else { wgpu::StoreOp::Discard } }) },
            stencil_ops: None }),
        timestamp_writes: None, occlusion_query_set: None, multiview_mask: None })
}

/// una textura RGBA8 con sus niveles (armados acá, promediando de a 4: como glGenerateMipmap)
fn textura(d: &wgpu::Device, q: &wgpu::Queue, w: u32, h: u32, px: &[u8], mips: bool) -> TexW {
    let niveles = if mips { 32 - w.max(h).max(1).leading_zeros() } else { 1 };
    let t = d.create_texture(&wgpu::TextureDescriptor { label: Some("tex"), size: wgpu::Extent3d { width: w, height: h, depth_or_array_layers: 1 }, mip_level_count: niveles, sample_count: 1,
        dimension: wgpu::TextureDimension::D2, format: FMT, usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST, view_formats: &[] });
    let (mut cw, mut ch, mut cur) = (w, h, px.to_vec()); let mut bytes = 0;
    for nv in 0..niveles {
        q.write_texture(wgpu::TexelCopyTextureInfo { texture: &t, mip_level: nv, origin: wgpu::Origin3d::ZERO, aspect: wgpu::TextureAspect::All }, &cur,
            wgpu::TexelCopyBufferLayout { offset: 0, bytes_per_row: Some(4 * cw), rows_per_image: Some(ch) }, wgpu::Extent3d { width: cw, height: ch, depth_or_array_layers: 1 });
        bytes += cur.len();
        if nv + 1 < niveles {
            let (nw, nh) = ((cw / 2).max(1), (ch / 2).max(1)); let mut sig = vec![0u8; (nw * nh * 4) as usize];
            for y in 0..nh { for x in 0..nw { for c in 0..4 {
                let p = |xx: u32, yy: u32| cur[((yy.min(ch - 1) * cw + xx.min(cw - 1)) * 4 + c) as usize] as u32;
                sig[((y * nw + x) * 4 + c) as usize] = ((p(2 * x, 2 * y) + p(2 * x + 1, 2 * y) + p(2 * x, 2 * y + 1) + p(2 * x + 1, 2 * y + 1) + 2) / 4) as u8;
            } } }
            cur = sig; cw = nw; ch = nh;
        }
    }
    TexW { v: t.create_view(&wgpu::TextureViewDescriptor::default()), bytes, _t: t }
}
fn cubo(d: &wgpu::Device, q: &wgpu::Queue, l: u32, caras: &[&[u8]]) -> TexW {
    let t = d.create_texture(&wgpu::TextureDescriptor { label: Some("cubo"), size: wgpu::Extent3d { width: l, height: l, depth_or_array_layers: 6 }, mip_level_count: 1, sample_count: 1,
        dimension: wgpu::TextureDimension::D2, format: FMT, usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST, view_formats: &[] });
    for (f, c) in caras.iter().enumerate().take(6) {
        q.write_texture(wgpu::TexelCopyTextureInfo { texture: &t, mip_level: 0, origin: wgpu::Origin3d { x: 0, y: 0, z: f as u32 }, aspect: wgpu::TextureAspect::All }, c,
            wgpu::TexelCopyBufferLayout { offset: 0, bytes_per_row: Some(4 * l), rows_per_image: Some(l) }, wgpu::Extent3d { width: l, height: l, depth_or_array_layers: 1 });
    }
    TexW { v: t.create_view(&wgpu::TextureViewDescriptor { dimension: Some(wgpu::TextureViewDimension::Cube), ..Default::default() }), bytes: (l * l * 24) as usize, _t: t }
}
fn prof_tex(d: &wgpu::Device, w: u32, h: u32) -> TexW {
    let t = d.create_texture(&wgpu::TextureDescriptor { label: Some("prof"), size: wgpu::Extent3d { width: w, height: h, depth_or_array_layers: 1 }, mip_level_count: 1, sample_count: 1,
        dimension: wgpu::TextureDimension::D2, format: FMT_P, usage: wgpu::TextureUsages::RENDER_ATTACHMENT | wgpu::TextureUsages::TEXTURE_BINDING, view_formats: &[] });
    TexW { v: t.create_view(&wgpu::TextureViewDescriptor::default()), bytes: (w * h * 4) as usize, _t: t }
}
fn color1(d: &wgpu::Device, w: u32, h: u32) -> Color1 {
    let t = d.create_texture(&wgpu::TextureDescriptor { label: Some("color"), size: wgpu::Extent3d { width: w, height: h, depth_or_array_layers: 1 }, mip_level_count: 1, sample_count: 1,
        dimension: wgpu::TextureDimension::D2, format: FMT, usage: wgpu::TextureUsages::RENDER_ATTACHMENT | wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST, view_formats: &[] });
    Color1 { v: t.create_view(&wgpu::TextureViewDescriptor::default()), t, w, h }
}
/// un destino de color y profundidad (la profundidad se puede leer: la oclusión y el agua)
fn destino(d: &wgpu::Device, w: u32, h: u32) -> Rt {
    let color = d.create_texture(&wgpu::TextureDescriptor { label: Some("escena"), size: wgpu::Extent3d { width: w, height: h, depth_or_array_layers: 1 }, mip_level_count: 1, sample_count: 1,
        dimension: wgpu::TextureDimension::D2, format: FMT, usage: wgpu::TextureUsages::RENDER_ATTACHMENT | wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_SRC, view_formats: &[] });
    let p = prof_tex(d, w, h);
    Rt { cv: color.create_view(&wgpu::TextureViewDescriptor::default()), color, pv: p.v, _prof: p._t, w, h }
}

/// la placa para dibujar sin ventana (el banco de pruebas) o con la superficie que se pase: Vulkan primero, GLES si no hay
pub fn placa(instancia: &wgpu::Instance, superficie: Option<&wgpu::Surface>) -> Result<(wgpu::Adapter, wgpu::Device, wgpu::Queue, String), String> {
    let ad = pollster::block_on(instancia.request_adapter(&wgpu::RequestAdapterOptions { power_preference: wgpu::PowerPreference::HighPerformance, force_fallback_adapter: false, compatible_surface: superficie, ..Default::default() }))
        .map_err(|e| format!("sin placa: {e}"))?;
    let info = ad.get_info();
    let lim = wgpu::Limits::downlevel_defaults().using_resolution(ad.limits());
    let (d, q) = pollster::block_on(ad.request_device(&wgpu::DeviceDescriptor { label: Some("jxmotor"), required_features: wgpu::Features::empty(), required_limits: lim, ..Default::default() }))
        .map_err(|e| format!("sin dispositivo: {e}"))?;
    Ok((ad, d, q, format!("{} ({:?}, {})", info.name, info.backend, info.driver)))
}
