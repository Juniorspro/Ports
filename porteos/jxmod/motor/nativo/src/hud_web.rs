//! El HUD como el de la web: dónde va cada botón (hudV2Pos de hud.js —la disposición nueva—, con la referencia de 1280 × 720,
//! el tamaño de los controles y los mínimos para el dedo) y sus íconos (HUD_SVG de hud.js, pintados una vez con
//! iconos::pintar_svg en un atlas). Arriba a la izquierda, los grupos del sistema (pausa, chat, celular) y de crear (objetos,
//! MOD) en columnas sin huecos; arriba a la derecha el arma, la cámara, los emotes, borrar, la cámara libre y la linterna;
//! abajo a la derecha saltar, agacharse, disparar y los demás; la barra de armas en fila arriba a la derecha.
use super::{Boton, Btn};
use super::jugabilidad::Bj;
use super::personajes::Bp;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::OnceLock;

/// el tamaño de los controles en milésimos (hudTam de la web: 0,776 de fábrica; lo cambia el editor de controles)
pub static TAM: AtomicU32 = AtomicU32::new(776);
pub fn tam() -> f32 { TAM.load(Ordering::Relaxed) as f32 / 1000.0 }
/// la escala de la referencia (1280 × 720, mezclando ancho y alto, como el CanvasScaler de la web)
pub fn kb(w: f32, h: f32) -> f32 { ((w / 1280.0) * (h / 720.0)).sqrt() }
/// cuántos píxeles de la pantalla son un px de la web: los de un celular de 873 × 393 (la web cuenta en px de CSS y el
/// teléfono tiene 2 o 3 píxeles por cada uno; acá todo va en píxeles de verdad)
pub fn css(w: f32, h: f32) -> f32 { kb(w, h) / kb(873.0, 393.0) }

/// arriba a la derecha: [x desde el borde derecho, y desde arriba, tamaño, mínimo en px] (HUD_V2.ad; Bajar es #bbajar)
const AD: [(Boton, [f32; 4]); 9] = [
    (Boton::Arma, [-66.0, 66.0, 100.0, 48.0]), (Boton::Camara, [-176.0, 66.0, 84.0, 40.0]), (Boton::Emotes, [-278.0, 66.0, 84.0, 40.0]),
    (Boton::Deshacer, [-66.0, 180.0, 88.0, 42.0]), (Boton::Bajar, [-66.0, 180.0, 88.0, 42.0]), (Boton::Jg(Bj::CamLibre), [-176.0, 180.0, 84.0, 40.0]),
    (Boton::Jg(Bj::Linterna), [-278.0, 180.0, 84.0, 40.0]), (Boton::Jg(Bj::CamL), [-226.0, 266.0, 70.0, 34.0]), (Boton::Jg(Bj::CamR), [-126.0, 266.0, 70.0, 34.0]),
];
/// abajo a la derecha: [x desde el borde derecho, y desde abajo, tamaño, mínimo en px] (HUD_V2.ab: volar va donde #bcorrer,
/// girar donde #brotar y el Cíclope donde #bvolver)
const AB: [(Boton, [f32; 4]); 11] = [
    (Boton::Saltar, [-90.0, 90.0, 136.0, 54.0]), (Boton::Agachar, [-228.0, 74.0, 104.0, 48.0]), (Boton::Disparo, [-235.0, 262.0, 176.0, 64.0]),
    (Boton::Disparo2, [-74.0, 300.0, 104.0, 48.0]), (Boton::Jg(Bj::Patada), [-344.0, 100.0, 92.0, 42.0]), (Boton::Volar, [-462.0, 72.0, 86.0, 38.0]),
    (Boton::Recargar, [-410.0, 282.0, 96.0, 44.0]), (Boton::Girar, [-410.0, 282.0, 96.0, 44.0]), (Boton::Lejos, [-170.0, 402.0, 84.0, 38.0]), (Boton::Cerca, [-302.0, 404.0, 84.0, 38.0]),
    (Boton::Jg(Bj::Ciclope), [-452.0, 170.0, 86.0, 38.0]),
];
/// (los de la web que acá no hay —las teclas de los mods—: cuentan para la escala del grupo, como allá)
const AB_WEB: [[f32; 4]; 4] = [[-170.0, 404.0, 90.0, 40.0], [-300.0, 404.0, 90.0, 40.0], [-450.0, 400.0, 90.0, 40.0], [-540.0, 290.0, 90.0, 40.0]];
/// los que la web ubica con HUD_TACTIL (desde un ancla: 0,5 = el medio, 1 = el borde derecho; y desde abajo) —usar, la
/// bocina y el turbo—: [ancla, x, y, tamaño, mínimo]
const TACTIL: [(Boton, [f32; 5]); 3] = [(Boton::Usar, [0.5, 40.0, 175.0, 95.0, 38.0]), (Boton::Bocina, [1.0, -292.0, 318.0, 90.0, 38.0]), (Boton::Turbo, [1.0, -440.0, 232.0, 95.0, 40.0])];

// ---- arriba a la izquierda: los grupos (HUD_ZONAS de hudorden.js) ----
/// cuáles de arriba a la izquierda se ven (los demás van después, sin dejar huecos): lo pone el juego en cada cuadro
pub const VE_CHAT: u32 = 1;
pub const VE_CELU: u32 = 2;
pub const VE_OBJ: u32 = 4;
pub const VE_MOD: u32 = 8;
pub static ZONA_VE: AtomicU32 = AtomicU32::new(VE_CELU | VE_OBJ | VE_MOD);
#[derive(Clone, Copy)]
enum Iz { Pausa, B(Boton, u32) }
const SIS: [Iz; 3] = [Iz::Pausa, Iz::B(Boton::Chat, VE_CHAT), Iz::B(Boton::Pj(Bp::Celular), VE_CELU)];
const CREAR: [Iz; 2] = [Iz::B(Boton::Objetos, VE_OBJ), Iz::B(Boton::Jg(Bj::Mod), VE_MOD)];
/// las medidas de la zona (HUD_V2.zona): tamaño, margen, hueco entre botones y entre grupos
const ZS: f32 = 96.0;
const ZM: f32 = 20.0;
const ZG: f32 = 18.0;
const ZGG: f32 = 10.0;

/// todos los botones en px (centro y tamaño) y la pausa (cx, cy, lado), para la pantalla de w × h y `n_armas` en la barra
pub(super) fn disposicion(w: f32, h: f32, n_armas: usize) -> (Vec<Btn>, [f32; 3]) {
    let (kb, f, c) = (kb(w, h), tam(), css(w, h)); let (k, fz) = (kb * f, f / 0.8 * c);
    let mut v = Vec::with_capacity(48);
    // ---- la derecha: arriba y abajo, cada uno con su escala (la del tamaño elegido o la que pide el mínimo de cada botón);
    // si no entran los dos en el alto, se achican lo justo ----
    let ad: Vec<[f32; 4]> = AD.iter().map(|x| x.1).collect();
    let ab: Vec<[f32; 4]> = AB.iter().map(|x| x.1).chain(AB_WEB).collect();
    let esc = |t: &[[f32; 4]]| t.iter().fold(k, |q, x| q.max(x[3] * fz / x[2]));
    let tope = |t: &[[f32; 4]]| t.iter().fold(0f32, |q, x| q.max(x[1] + x[2] / 2.0));
    let (mut kd, mut kab) = (esc(&ad), esc(&ab));
    let q = ((h - 6.0 * c) / (tope(&ad) * kd + tope(&ab) * kab)).min(1.0); kd *= q; kab *= q;
    for (b, [dx, dy, s, _]) in AD { v.push(Btn { b, x: w + dx * kd, y: dy * kd, w: s * kd, h: s * kd, redondo: b != Boton::Arma }); }
    for (b, [dx, dy, s, _]) in AB { v.push(Btn { b, x: w + dx * kab, y: h - dy * kab, w: s * kab, h: s * kab, redondo: true }); }
    for (b, [ax, x0, y0, s0, mn]) in TACTIL { let t = (s0 * k).max(mn * fz); v.push(Btn { b, x: ax * w + x0 * kb, y: h - y0 * kb, w: t, h: t, redondo: true }); }
    // ---- la barra de armas (#barra): en fila arriba a la derecha, 10 px del borde y 6 de arriba, 44 × 40 con 4 de hueco a la
    // escala de los controles (--hk); si no entra, más chica ----
    let hk = k / 0.559; let n = n_armas.max(1) as f32; let (mut tw, mut th, mut gap) = (44.0 * hk, 40.0 * hk, 4.0 * hk);
    let total = n * tw + (n - 1.0) * gap; if total > w - 20.0 * c { let s = (w - 20.0 * c) / total; tw *= s; th *= s; gap *= s; }
    for i in 0..n_armas { v.push(Btn { b: Boton::ArmaN(i), x: w - 10.0 * c - (n - 1.0 - i as f32) * (tw + gap) - tw / 2.0, y: 6.0 * c + th / 2.0, w: tw, h: th, redondo: false }); }
    // ---- arriba a la izquierda: columnas por grupo, los que se ven primero; con 3 filas o con 2, la que deje los botones más
    // grandes sin bajar a la zona de la palanca (el 45 % del alto) ni llegar a los de arriba a la derecha ----
    let ve = ZONA_VE.load(Ordering::Relaxed); let visible = |z: &Iz| match z { Iz::Pausa => true, Iz::B(_, bit) => ve & bit != 0 };
    let armar = |r: usize| {
        let (mut o, mut x, mut der) = (vec![], ZM, 0f32);
        for zona in [&SIS[..], &CREAR[..]] {
            let nv = zona.iter().filter(|z| visible(z)).count();
            for (i, z) in zona.iter().filter(|z| visible(z)).chain(zona.iter().filter(|z| !visible(z))).enumerate() {
                let (c, fi) = (i / r, i % r); let cx = x + c as f32 * (ZS + ZG) + ZS / 2.0;
                o.push((*z, cx, ZM + fi as f32 * (ZS + ZG) + ZS / 2.0)); if i < nv { der = der.max(cx + ZS / 2.0); }
            }
            if nv > 0 { x += nv.div_ceil(r) as f32 * (ZS + ZG) + ZGG; }
        }
        (o, der)
    };
    let ka0 = k.max(44.0 * fz / ZS).max(40.0 * fz / 88.0); let libre = h * 0.45 - 4.0 * c; let ancho = w - 320.0 * kd - 10.0 * c;
    let alto = |r: usize| ZM + r as f32 * ZS + (r as f32 - 1.0) * ZG;
    let mut mejor: Option<(f32, Vec<(Iz, f32, f32)>)> = None;
    for r in [3, 2] {
        let (o, der) = armar(r); let ka = ka0.min(libre / alto(r)).min(if der > 0.0 { ancho / der } else { ka0 });
        if mejor.as_ref().map_or(true, |m| ka > m.0 * 1.001) { mejor = Some((ka, o)); }
    }
    let (ka, o) = mejor.unwrap_or((ka0, vec![])); let mut pausa = [(ZM + ZS / 2.0) * ka, (ZM + ZS / 2.0) * ka, ZS * ka];
    for (z, cx, cy) in o { match z { Iz::Pausa => pausa = [cx * ka, cy * ka, ZS * ka], Iz::B(b, _) => v.push(Btn { b, x: cx * ka, y: cy * ka, w: ZS * ka, h: ZS * ka, redondo: true }) } }
    (v, pausa)
}

/// dónde terminan, abajo, los botones de arriba a la izquierda que se ven (lo que se escribe ahí —los fps— va debajo)
pub(super) fn bajo_izq(w: f32, h: f32) -> f32 {
    let (v, p) = disposicion(w, h, 0); let ve = ZONA_VE.load(Ordering::Relaxed);
    let bit = |b: Boton| SIS.iter().chain(CREAR.iter()).find_map(|z| match z { Iz::B(x, k) if *x == b => Some(*k), _ => None });
    v.iter().filter(|b| bit(b.b).is_some_and(|k| ve & k != 0)).fold(p[1] + p[2] / 2.0, |m, b| m.max(b.y + b.h / 2.0)) + 8.0 * css(w, h)
}
/// la palanca de la web (#palanca): quieta abajo a la izquierda —40 px de los bordes—, de 230 unidades (entre 70 y 240 px);
/// el dedo la mueve a donde se apoya. Devuelve el centro y el lado; el recorrido de la bolita es el 42 % del lado
pub fn palanca(w: f32, h: f32) -> (f32, f32, f32) {
    let c = css(w, h); let p = (230.0 * kb(w, h) * tam()).clamp(70.0 * c, 240.0 * c);
    (40.0 * c + p / 2.0, h - 40.0 * c - p / 2.0, p)
}

// ---- los íconos ----
/// los de HUD_SVG (hud.js, viewBox 0 0 24 24), con «volar» propio (las alas y la flecha para arriba)
pub const ICONOS: [(&str, &str); 31] = [
    ("pausa", r##"<rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="#fff"/><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="#fff"/>"##),
    ("props", r##"<path d="M12 2.8l8 4.2v9.8l-8 4.4-8-4.4V7z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><path d="M4.3 7.2L12 11.4l7.7-4.2M12 11.4v9.4" fill="none" stroke="#fff" stroke-width="1.6" opacity=".8"/>"##),
    ("chat", r##"<path d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 20 17h-8.5L7 20.5V17H4a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 4 5.5z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><circle cx="8" cy="11.3" r="1.3" fill="#fff"/><circle cx="12" cy="11.3" r="1.3" fill="#fff"/><circle cx="16" cy="11.3" r="1.3" fill="#fff"/>"##),
    ("emote", r##"<circle cx="12" cy="4.6" r="2.3" fill="#fff"/><path d="M12 7.6v6.6M12 9.4l-5-3.4M12 9.4l4.6 1.4 2.8-4M12 14.2l-3.6 6.4M12 14.2l3.2 6.6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>"##),
    ("camlibre", r##"<rect x="7.6" y="8.9" width="8.8" height="6.2" rx="1.4" fill="none" stroke="#fff" stroke-width="1.8"/><circle cx="12" cy="12" r="1.6" fill="#fff"/><path d="M12 2.5v3.6M12 17.9v3.6M2.5 12h3.6M17.9 12h3.6" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><path d="M10.2 4.3L12 2.5l1.8 1.8M10.2 19.7l1.8 1.8 1.8-1.8M4.3 10.2L2.5 12l1.8 1.8M19.7 10.2l1.8 1.8-1.8 1.8" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>"##),
    ("camara", r##"<path d="M3.5 8.5h3l1.6-2.5h7.8l1.6 2.5h3v10h-17z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="13.3" r="3.2" fill="none" stroke="#fff" stroke-width="2"/>"##),
    ("disparo", r##"<circle cx="12" cy="12" r="7" fill="none" stroke="#f2b31b" stroke-width="2.1"/><path d="M12 1.8v5.2M12 17v5.2M1.8 12H7M17 12h5.2" stroke="#f2b31b" stroke-width="2.3" stroke-linecap="round"/><circle cx="12" cy="12" r="1.7" fill="#f2b31b"/>"##),
    ("correr", r##"<circle cx="14.6" cy="4.2" r="2.2" fill="#fff"/><path d="M6.2 9.6l3.6-2.4 4.3.6 2.2 3.4 3 1M10.6 8l-2 5.6 4 2.6-1.6 5M8.6 13.6l-3.4 3.6-3-.2M13.6 11.4l2.2 3.4" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>"##),
    ("patada", r##"<path d="M8.6 3.2h4.8v8.3l5.7 2.1a2.6 2.6 0 0 1 1.7 2.4v2.4H8.6z" fill="#fff"/><path d="M8.2 20.3h12.4" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M2.6 9.4h3.6M2 13.2h4.2M2.8 17h3.4" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".75"/>"##),
    ("salto", r##"<path d="M12 3.5l6.5 7h-4v6h-5v-6h-4z" fill="#fff"/><path d="M5 20.5h14" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>"##),
    ("agachar", r##"<path d="M12 16.5l6.5-7h-4v-6h-5v6h-4z" fill="#fff"/><path d="M5 20.5h14" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>"##),
    ("recargar", r##"<path d="M19 12a7 7 0 1 1-2.1-5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><path d="M19.5 3.5v5h-5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>"##),
    ("usar", r##"<path d="M9.5 12V5a1.6 1.6 0 0 1 3.2 0v5.2l5.6 1.2c1 .2 1.7 1.2 1.5 2.2l-1 5.3a2 2 0 0 1-2 1.6h-5.4a2 2 0 0 1-1.6-.8L5 15.6a1.5 1.5 0 0 1 2.2-2z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>"##),
    ("borrar", r##"<path d="M4.5 6.5h15M9.5 6.5V4h5v2.5M6.5 6.5l1 13.5h9l1-13.5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 10v6.5M14 10v6.5" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>"##),
    ("congelar", r##"<g stroke="#9fe3ff" stroke-width="2" stroke-linecap="round" fill="none"><path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6"/><path d="M9.5 3.8L12 6l2.5-2.2M9.5 20.2L12 18l2.5 2.2M3.7 10.4l3-.9-.6-3.2M20.3 13.6l-3 .9.6 3.2M3.7 13.6l3 .9-.6 3.2M20.3 10.4l-3-.9.6-3.2"/></g>"##),
    ("rotar", r##"<path d="M5 12a7 7 0 0 1 12-5l1.5 1.5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><path d="M19 4v5h-5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 12a7 7 0 0 1-12 5l-1.5-1.5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".6"/>"##),
    ("mas", r##"<path d="M12 5v14M5 12h14" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>"##),
    ("menos", r##"<path d="M5 12h14" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>"##),
    ("bocina", r##"<path d="M4 9.5h3.2L13 5.5v13l-5.8-4H4z" fill="#fff"/><path d="M16 8.6a5 5 0 0 1 0 6.8M18.6 6.2a8.5 8.5 0 0 1 0 11.6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/>"##),
    ("turbo", r##"<path d="M12 2.5c3 2.5 4.5 5.6 4.5 9.2V16h-9v-4.3c0-3.6 1.5-6.7 4.5-9.2z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="9.5" r="1.7" fill="#fff"/><path d="M9.5 18.5l-1 3M12 18.5v3.5M14.5 18.5l1 3" stroke="#ffb347" stroke-width="2" stroke-linecap="round"/>"##),
    ("celular", r##"<rect x="6.5" y="2.5" width="11" height="19" rx="2.4" fill="none" stroke="#fff" stroke-width="2"/><path d="M10 5.2h4" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="18.2" r="1.1" fill="#fff"/><path d="M9.4 9.2h2v2h-2zM12.6 9.2h2v2h-2zM9.4 12.4h2v2h-2zM12.6 12.4h2v2h-2z" fill="#fff"/>"##),
    ("dos", r##"<circle cx="12" cy="12" r="8" fill="none" stroke="#fff" stroke-width="2"/><path d="M9.3 9.6a2.8 2.8 0 0 1 5.4 1c0 2-5.3 3.6-5.3 5.4h5.5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>"##),
    ("linterna", r##"<g transform="rotate(-40 12 12)"><rect x="2" y="9.7" width="9.6" height="4.6" rx="1.3" fill="none" stroke="#fff" stroke-width="1.9"/><path d="M11.6 9.5l2.9-2.1h1.4v9.2h-1.4l-2.9-2.1z" fill="#fff"/><circle cx="6.8" cy="12" r="1" fill="#fff"/></g><path d="M17.8 8.9l3.3-.6M17.2 7.6l2.6-2.2M16.1 6.9l1.2-3" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/>"##),
    ("bajar", r##"<path d="M10 4H5.5v16H10" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.5 12h9M16 8l3.8 4-3.8 4" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>"##),
    ("volver", r##"<path d="M4.5 9.5A8 8 0 1 1 6 16" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><path d="M3.5 4.5v5h5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12.5" cy="12" r="2.3" fill="#fff"/>"##),
    ("ojo", r##"<path d="M2.2 12S5.8 5.8 12 5.8 21.8 12 21.8 12 18.2 18.2 12 18.2 2.2 12 2.2 12z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.4" fill="#fff"/>"##),
    // (las piezas de los botones: el círculo, su filo fino, el cuadrado redondeado del arma y su filo)
    ("disco", r##"<circle cx="12" cy="12" r="12" fill="#fff"/>"##),
    ("aro", r##"<circle cx="12" cy="12" r="11.7" fill="none" stroke="#fff" stroke-width="0.6"/>"##),
    ("caja", r##"<rect x="0" y="0" width="24" height="24" rx="2.9" fill="#fff"/>"##),
    ("caja_aro", r##"<rect x="0.3" y="0.3" width="23.4" height="23.4" rx="2.6" fill="none" stroke="#fff" stroke-width="0.6"/>"##),
    ("volar", r##"<path d="M11.4 9.6C9.6 6.4 6.6 4.6 2.2 4.4c.8 3.3 2.4 5.6 4.9 6.7-1.6.6-2.6 1.7-3.1 3.2 2.7.5 5.1-.2 7.4-2.4z" fill="#fff"/><path d="M12.6 9.6c1.8-3.2 4.8-5 9.2-5.2-.8 3.3-2.4 5.6-4.9 6.7 1.6.6 2.6 1.7 3.1 3.2-2.7.5-5.1-.2-7.4-2.4z" fill="#fff"/><path d="M12 8.6v11.4M9.4 17.4l2.6 2.6 2.6-2.6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>"##),
];
/// el lado de cada ícono en el atlas y cuántos por fila
pub const LADO: u32 = 128;
pub const COLS: u32 = 8;
/// el atlas (1024 × 512, RGBA): se pinta una sola vez por proceso (después de vaciar el motor se vuelve a subir el mismo)
pub fn atlas() -> &'static (u32, u32, Vec<u8>) {
    static A: OnceLock<(u32, u32, Vec<u8>)> = OnceLock::new();
    A.get_or_init(|| {
        let (aw, ah) = (COLS * LADO, (ICONOS.len() as u32).div_ceil(COLS).next_power_of_two() * LADO); let mut px = vec![0u8; (aw * ah * 4) as usize];
        for (i, (_, cuerpo)) in ICONOS.iter().enumerate() {
            let ic = crate::iconos::pintar_svg(&format!("<svg viewBox=\"0 0 24 24\">{cuerpo}</svg>"), LADO as usize);
            let (cx, cy) = ((i as u32 % COLS) * LADO, (i as u32 / COLS) * LADO);
            for y in 0..LADO { let d = (((cy + y) * aw + cx) * 4) as usize; let s = (y * LADO * 4) as usize; px[d..d + (LADO * 4) as usize].copy_from_slice(&ic[s..s + (LADO * 4) as usize]); }
        }
        (aw, ah, px)
    })
}
/// las coordenadas de un ícono en el atlas (u0, v0, u1, v1)
pub fn uv(nombre: &str) -> Option<[f32; 4]> {
    let i = ICONOS.iter().position(|x| x.0 == nombre)? as u32; let (aw, ah) = (COLS * LADO, (ICONOS.len() as u32).div_ceil(COLS).next_power_of_two() * LADO);
    let (cx, cy) = ((i % COLS) * LADO, (i / COLS) * LADO);
    Some([cx as f32 / aw as f32, cy as f32 / ah as f32, (cx + LADO) as f32 / aw as f32, (cy + LADO) as f32 / ah as f32])
}

#[cfg(test)]
mod pruebas {
    use super::*;
    /// (como la web en un celular de 873 × 393: la pausa en 10, 10 con 46 de lado y el salto abajo a la derecha)
    #[test]
    fn como_la_web() {
        ZONA_VE.store(VE_CHAT | VE_CELU | VE_OBJ | VE_MOD, Ordering::Relaxed);
        let (v, p) = disposicion(873.0, 393.0, 15);
        assert!((p[0] - p[2] / 2.0 - 9.5).abs() < 1.5 && (p[2] - 45.5).abs() < 1.5, "pausa {p:?}");
        let b = |x: Boton| v.iter().find(|b| b.b == x).map(|b| (b.x, b.y, b.w)).unwrap();
        let s = b(Boton::Saltar); assert!((s.0 - 829.0).abs() < 3.0 && (s.1 - 349.0).abs() < 3.0, "saltar {s:?}");
        let c = b(Boton::Chat); assert!((c.0 - p[0]).abs() < 0.5 && c.1 > p[1] + 40.0, "chat debajo de la pausa {c:?}");
        let o = b(Boton::Objetos); assert!(o.0 > p[0] + 50.0 && (o.1 - p[1]).abs() < 0.5, "objetos al lado {o:?}");
        // (sin chat, el celular sube y queda debajo de la pausa)
        ZONA_VE.store(VE_CELU | VE_OBJ | VE_MOD, Ordering::Relaxed);
        let (v, p) = disposicion(873.0, 393.0, 15); let ce = v.iter().find(|b| b.b == Boton::Pj(Bp::Celular)).unwrap();
        assert!((ce.x - p[0]).abs() < 0.5 && (ce.y - p[1] - p[2] - 18.0 * p[2] / 96.0).abs() < 1.0);
        // (la barra de armas entra en el ancho)
        assert!(v.iter().filter(|b| matches!(b.b, Boton::ArmaN(_))).all(|b| b.x - b.w / 2.0 >= 9.0 && b.x + b.w / 2.0 <= 864.0));
    }
    #[test]
    fn iconos_pintados() {
        let (aw, ah, px) = atlas(); assert_eq!((*aw, *ah), (1024, 512));
        // (cada ícono con algo pintado)
        for i in 0..ICONOS.len() as u32 { let (cx, cy) = ((i % COLS) * LADO, (i / COLS) * LADO); let mut n = 0;
            for y in 0..LADO { for x in 0..LADO { if px[(((cy + y) * aw + cx + x) * 4 + 3) as usize] > 128 { n += 1; } } }
            assert!(n > 300, "{} casi vacío: {n}", ICONOS[i as usize].0); }
    }
}

// ---------------- el dibujo ----------------
/// los colores de los botones de la web (template.html, «los botones táctiles con el estilo del concepto de GOLDEN»)
const FONDO: [f32; 4] = [14.0 / 255.0, 15.0 / 255.0, 18.0 / 255.0, 0.5];
const FILO: [f32; 4] = [1.0, 1.0, 1.0, 0.55];
const AMA: [f32; 3] = [242.0 / 255.0, 179.0 / 255.0, 27.0 / 255.0];
const NEGRO_T: [f32; 4] = [20.0 / 255.0, 20.0 / 255.0, 20.0 / 255.0, 1.0];
/// la textura del atlas del HUD
pub const TEX_HUD: i64 = -2003;
fn pieza(v: &mut Vec<f32>, n: &str, x: f32, y: f32, w: f32, h: f32, col: [f32; 4]) { if let Some(uv) = uv(n) { super::rect_uv(v, x, y, w, h, uv, col); } }
/// la sombra de abajo de un botón (box-shadow: 0 2px 10px rgba(0,0,0,.28)): capas apenas oscuras, cada vez más grandes
fn sombra(v: &mut Vec<f32>, n: &str, x: f32, y: f32, w: f32, h: f32, c: f32) {
    for k in [6.0f32, 4.0, 2.0] { let e = k * c; pieza(v, n, x - e, y - e + 2.0 * c, w + 2.0 * e, h + 2.0 * e, [0.0, 0.0, 0.0, 0.045]); }
}

impl super::Juego {
    /// cuáles de arriba a la izquierda se ven (para ubicarlos sin huecos, como la web)
    pub(super) fn zona_ve(&self) -> u32 {
        let mut z = 0;
        if self.boton_visible(Boton::Chat) { z |= VE_CHAT; }
        if self.boton_visible(Boton::Pj(Bp::Celular)) { z |= VE_CELU; }
        if self.boton_visible(Boton::Objetos) { z |= VE_OBJ; }
        if self.boton_visible(Boton::Jg(Bj::Mod)) { z |= VE_MOD; }
        z
    }
    /// los botones como los de la web: el fondo, el filo y el ícono (en el atlas del HUD, que va antes que las letras: los
    /// números y las palabras quedan encima), y el arma con su ícono (TEX_ARMAS) y sus balas. Devuelve lo del atlas del HUD
    pub(super) fn hud_botones(&self, l: &jxjuego::texto::Letras, u: &mut Vec<f32>, ia: &mut Vec<f32>, wf: f32, hf: f32, abierto: bool) -> Vec<f32> {
        ZONA_VE.store(self.zona_ve(), Ordering::Relaxed);
        let mut v: Vec<f32> = vec![]; let c = css(wf, hf);
        // (la palanca: quieta abajo a la izquierda, más clara; con el dedo, donde se apoyó y prendida)
        if !abierto && self.mapa.is_some() && !self.jg.sin_hud() && (self.vehs.jugador.is_none() || matches!(self.tipo_manejo(), Some(jxjuego::vehiculo::Tipo::Heli | jxjuego::vehiculo::Tipo::Avion))) {
            let (px, py, p) = palanca(wf, hf); let dedo = self.dedos.iter().find(|d| d.palanca);
            let (cx, cy, op) = dedo.map_or((px, py, 0.6), |d| (d.x0, d.y0, 1.0)); let r = p / 2.0;
            pieza(&mut v, "disco", cx - r, cy - r, p, p, [1.0, 1.0, 1.0, 0.12 * op]); pieza(&mut v, "aro", cx - r, cy - r, p, p, [1.0, 1.0, 1.0, 0.25 * op]);
            let (mut kx, mut ky) = dedo.map_or((0.0, 0.0), |d| (d.x - d.x0, d.y - d.y0)); let lim = p * 0.375; let n = (kx * kx + ky * ky).sqrt(); if n > lim { kx *= lim / n; ky *= lim / n; }
            let b = p * 0.42; pieza(&mut v, "disco", cx + kx - b / 2.0, cy + ky - b / 2.0, b, b, [1.0, 1.0, 1.0, 0.45 * op]);
        }
        if abierto { return v; }
        // (la pausa, primera arriba a la izquierda)
        if let Some(ap) = self.pausa_boton() {
            let [cx, cy, s] = disposicion(wf, hf, 0).1; let s = s * if ap { 0.94 } else { 1.0 }; let (x, y) = (cx - s / 2.0, cy - s / 2.0);
            sombra(&mut v, "disco", x, y, s, s, c);
            pieza(&mut v, "disco", x, y, s, s, if ap { [AMA[0], AMA[1], AMA[2], 0.34] } else { FONDO }); pieza(&mut v, "aro", x, y, s, s, if ap { [AMA[0], AMA[1], AMA[2], 1.0] } else { FILO });
            let lado = s * 0.56; pieza(&mut v, "pausa", cx - lado / 2.0, cy - lado / 2.0 + c, lado, lado, [0.0, 0.0, 0.0, 0.5]); pieza(&mut v, "pausa", cx - lado / 2.0, cy - lado / 2.0, lado, lado, [1.0; 4]);
        }
        let d = self.armas.def();
        for b in super::botones(wf, hf) {
            if !self.boton_visible(b.b) { continue; }
            let ap = self.apretado(b.b);
            // (qué ícono —o qué letras— y si está prendido: amarillo lleno con el ícono negro)
            let (ico, txt, on): (Option<&str>, &str, bool) = match b.b {
                Boton::Disparo => (Some("disparo"), "", false),
                Boton::Disparo2 => (Some(if d.n == "PhysicsGun" { "congelar" } else { "dos" }), "", self.armas.apunta || self.armas.zoom || self.armas.grav.is_some()),
                Boton::Recargar => (Some("recargar"), "", self.armas.recargando > 0.0),
                Boton::Usar => (Some("usar"), "", false),
                Boton::Bajar => (Some("bajar"), "", false),
                Boton::Girar => (Some("rotar"), "", self.armas.rotar),
                Boton::Lejos => (Some("mas"), "", false),
                Boton::Cerca => (Some("menos"), "", false),
                Boton::Camara => (Some("camara"), "", false),
                Boton::Saltar => match self.tipo_manejo() { Some(jxjuego::vehiculo::Tipo::Heli | jxjuego::vehiculo::Tipo::Avion) | None => (Some("salto"), "", false), Some(_) => (None, "Freno", false) },
                Boton::Agachar => (Some("agachar"), "", false),
                Boton::Volar => (Some("volar"), "", self.jug.noclip),
                Boton::Objetos => (Some("props"), "", self.menu.is_some()),
                Boton::Deshacer => (Some("borrar"), "", false),
                Boton::Bocina => (Some("bocina"), "", false),
                Boton::Turbo => (Some("turbo"), "", self.vehs.jugador.and_then(|j| self.vehs.de(j.0)).map_or(false, |v| v.turbo)),
                Boton::Chat => (Some("chat"), "", false),
                Boton::Emotes => (Some("emote"), "", self.emote.is_some() || self.emotes_panel),
                Boton::Jg(Bj::Mod) => (None, "MOD", self.jg_etiqueta(Bj::Mod).1),
                Boton::Jg(Bj::Linterna) => (Some("linterna"), "", self.jg_etiqueta(Bj::Linterna).1),
                Boton::Jg(Bj::CamLibre) => (Some("camlibre"), "", self.jg_etiqueta(Bj::CamLibre).1),
                Boton::Jg(Bj::CamL) => (None, "L", self.jg_etiqueta(Bj::CamL).1),
                Boton::Jg(Bj::CamR) => (None, "R", self.jg_etiqueta(Bj::CamR).1),
                Boton::Jg(Bj::Patada) => (Some("patada"), "", self.jg_etiqueta(Bj::Patada).1),
                Boton::Jg(Bj::Ciclope) => (Some("ojo"), "", self.jg_etiqueta(Bj::Ciclope).1),
                Boton::Pj(Bp::Celular) => (Some("celular"), "", self.pj_etiqueta(Bp::Celular).1),
                Boton::Arma | Boton::ArmaN(_) | Boton::Ajustes | Boton::Salas => (None, "", false),
            };
            // ---- la barra de armas: los recuadros de 44 × 40 con el ícono y el nombre; el elegido, con el filo verde ----
            if let Boton::ArmaN(k) = b.b {
                let (x, y) = (b.x - b.w / 2.0, b.y - b.h / 2.0);
                pieza(&mut v, "caja", x, y, b.w, b.h, [40.0 / 255.0, 52.0 / 255.0, 70.0 / 255.0, 0.6]);
                if k == self.armas.i { for e in [0.0, 0.6 * c] { pieza(&mut v, "caja_aro", x + e, y + e, b.w - 2.0 * e, b.h - 2.0 * e, [107.0 / 255.0, 224.0 / 255.0, 107.0 / 255.0, 1.0]); } }
                if self.armas_ico { let lado = b.h * 0.6; super::rect_uv(ia, b.x - lado / 2.0, y + b.h * 0.08, lado, lado, self.uv_arma(k), [1.0; 4]); }
                let nom = super::ARMAS[k].nom; let mut tt = (7.0 * c).max(b.h * 0.2); while l.ancho(tt, nom) > b.w * 0.94 && tt > 4.0 { tt *= 0.92; }
                l.texto(u, b.x - l.ancho(tt, nom) / 2.0, y + b.h * 0.7, tt, [1.0; 4], nom);
                continue;
            }
            // ---- el fondo y el filo: apretado, el amarillo transparente y un poco más chico; prendido, amarillo lleno ----
            let e = if ap { 0.94 } else { 1.0 }; let (bw, bh) = (b.w * e, b.h * e); let (x, y) = (b.x - bw / 2.0, b.y - bh / 2.0);
            let disparo = b.b == Boton::Disparo;
            let fondo = if on { [AMA[0], AMA[1], AMA[2], 1.0] } else if ap { [AMA[0], AMA[1], AMA[2], if disparo { 0.3 } else { 0.34 }] } else if disparo { [10.0 / 255.0, 11.0 / 255.0, 14.0 / 255.0, 0.6] } else { FONDO };
            let filo = if on || ap { [AMA[0], AMA[1], AMA[2], 1.0] } else if disparo { [1.0, 1.0, 1.0, 0.62] } else { FILO };
            let (f, a) = if b.redondo { ("disco", "aro") } else { ("caja", "caja_aro") };
            // (la sombra de abajo —box-shadow 0 2px 10px—, el halo amarillo de lo prendido —0 0 0 3px—)
            sombra(&mut v, f, x, y, bw, bh, c);
            if on { pieza(&mut v, f, x - 3.0 * c, y - 3.0 * c, bw + 6.0 * c, bh + 6.0 * c, [AMA[0], AMA[1], AMA[2], 0.28]); }
            pieza(&mut v, f, x, y, bw, bh, fondo); pieza(&mut v, a, x, y, bw, bh, filo);
            if disparo || b.b == Boton::Saltar { let e2 = 0.6 * c; pieza(&mut v, a, x + e2, y + e2, bw - 2.0 * e2, bh - 2.0 * e2, filo); }
            // ---- el arma en la mano (#armaAct): su ícono y abajo las balas en un globito (o el nombre, si no tiene) ----
            if b.b == Boton::Arma {
                let k = self.armas.i; let lado = bh * 0.56;
                if self.armas_ico { super::rect_uv(ia, b.x - lado / 2.0, b.y - lado / 2.0 - bh * 0.08, lado, lado, self.uv_arma(k), [1.0; 4]); }
                if d.car > 0 {
                    let s = format!("{} | ∞", self.armas.balas.get(k).copied().unwrap_or(d.car)); let tt = 10.0 * c; let an = l.ancho(tt, &s) + 10.0 * c; let ah = tt * 1.35;
                    l.caja(u, b.x - an / 2.0, y + bh - 3.0 * c - ah, an, ah, 6.0 * c, [10.0 / 255.0, 11.0 / 255.0, 14.0 / 255.0, 0.78]);
                    l.texto(u, b.x - an / 2.0 + 5.0 * c, y + bh - 3.0 * c - ah + tt * 0.12, tt, [1.0; 4], &s);
                } else {
                    let n = d.nom; let mut tt = 9.0 * c; while l.ancho(tt, n) > bw * 0.9 && tt > 4.0 { tt *= 0.92; }
                    l.texto_sombra(u, b.x - l.ancho(tt, n) / 2.0, y + bh * 0.76, tt, [1.0; 4], n);
                }
                continue;
            }
            // ---- el ícono (con su sombrita, como el drop-shadow de la web) o las letras ----
            if let Some(n) = ico {
                let lado = bw * match b.b { Boton::Disparo => 0.62, Boton::Saltar | Boton::Agachar => 0.5, _ => 0.56 };
                let (ix, iy) = (b.x - lado / 2.0, b.y - lado / 2.0);
                if on { pieza(&mut v, n, ix, iy, lado, lado, NEGRO_T); }
                else { pieza(&mut v, n, ix, iy + 1.0 * c, lado, lado, [0.0, 0.0, 0.0, 0.5]); pieza(&mut v, n, ix, iy, lado, lado, [1.0; 4]); }
            } else if !txt.is_empty() {
                let mut tt = if txt.chars().count() == 1 { bh * 0.42 } else { bh * 0.26 }; while l.ancho(tt, txt) > bw * 0.8 && tt > 4.0 { tt *= 0.92; }
                l.texto(u, b.x - l.ancho(tt, txt) / 2.0, b.y - tt * 0.55, tt, if on { NEGRO_T } else { [1.0; 4] }, txt);
            }
            // (usar: qué hace, chiquito abajo —subir, sentarse, abrir—)
            if b.b == Boton::Usar {
                let t = if let (Some(t), false) = (self.mj.usar_txt, self.usar_ve) { t } else if let (Some(t), false) = (self.jg.usar_txt, self.usar_ve) { t } else { "Subir" };
                let tt = 10.0 * c; l.texto_sombra(u, b.x - l.ancho(tt, t) / 2.0, b.y + bh / 2.0 + 3.0 * c, tt, [1.0; 4], t);
            }
        }
        v
    }
    /// el ícono de un arma en el atlas de las armas (10 por fila, de ICO píxeles)
    fn uv_arma(&self, k: usize) -> [f32; 4] {
        let (cx, cy) = ((k as u32 % super::ICO_COLS) * super::ICO, (k as u32 / super::ICO_COLS) * super::ICO); let (aw, ah) = (1024.0f32, self.armas_ico_h as f32);
        [cx as f32 / aw, cy as f32 / ah, (cx + super::ICO) as f32 / aw, (cy + super::ICO) as f32 / ah]
    }
}
