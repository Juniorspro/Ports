//! El menú de objetos con la forma del menú Q de GMod, en ventanas Aero (aero.rs): a la izquierda la ventana de objetos (las
//! pestañas arriba —Props, NPCs, Vehículos, Mods: su ícono de color y el nombre, la elegida azul con brillo—, la columna con
//! el buscador y las categorías, la grilla de tarjetas y el pie con Congelado o cómo se usan las Opciones) y a la derecha,
//! siempre a la vista, la ventana de herramientas (la lista de la Tool Gun y al lado el panel de la elegida: su ayuda y cada
//! parámetro con sus valores para tocar). Todo con el pincel de los menús (pincel.rs).
use super::*;
use crate::pincel::{rgba, Atlas, Cara, Col, Pincel};
use super::aero::{self, blanco, negro, Aero, OpVentana};

const FONDO: Col = rgba(0x0a0e14, 0.84);
const BARRA: Col = rgba(0x070b11, 0.6);
const COLUMNA: Col = rgba(0x0d131c, 0.7);
const LIN: Col = rgba(0xffffff, 0.13);
const PL: Col = rgba(0x172130, 1.0);
const T1: Col = rgba(0xf1f5fa, 1.0);
const T2: Col = rgba(0xc6d1de, 1.0);
const T3: Col = rgba(0x8d9aab, 1.0);
/// el azul Aero (lo elegido) y el texto sobre él
const AMA: Col = rgba(0x2f8ae8, 1.0);
const NEG: Col = rgba(0xffffff, 1.0);

const PESTANAS: [(&str, &str); 5] = [("Props", "ico_props"), ("NPCs", "ico_ragdoll"), ("Vehículos", "ico_auto"), ("Herramientas", "ico_herr"), ("Mods", "ico_mod")];
/// el ícono de color de cada Opción (las de la web: volar, muñeco de trapo, SCP, Cíclope)
fn ico_opcion(it: &str) -> &'static str { if let Some(a) = crate::comun::jugabilidad::agua_juego::ITEMS.iter().find(|a| a.0 == it) { return a.2; } match it { "opc:construir" => "ico_herr", "opc:volar" => "ico_volar", "opc:ragdoll" => "ico_ragdoll", "opc:scp" => "ico_scp", "opc:ciclope" => "ico_ciclope", "opc:radio" => "radio", "opc:piano" => "ico_piano", x if x.starts_with("mun:") => "ico_balas", x if x.starts_with("tmod:") => "ico_mod", _ => "ico_mod" } }

/// las pestañas que se ven en la ventana de objetos (las herramientas tienen su ventana)
const VISIBLES: [usize; 4] = [0, 1, 2, PESTANA_MODS];
/// dónde va cada cosa (en px de la pantalla; las medidas de la web, en px de CSS, por css())
pub struct Geo { pub c: f32, pub u: f32,
    /** la ventana de objetos (con el marco), su adentro y su X */ pub ven: [f32; 4], pub caja: [f32; 4], pub cerrar: [f32; 4],
    /** la ventana de herramientas, su adentro, la lista y el panel de la elegida, y el alto de cada renglón de la lista */ pub ven_h: [f32; 4], pub caja_h: [f32; 4], pub lista_h: [f32; 4], pub panel_h: [f32; 4], pub fila_h: f32,
    /** las pestañas (dónde, con el nombre o sólo el ícono, cuál es) */ pub tabs: Vec<([f32; 4], bool, usize)>, pub tab_f: f32, pub tab_pad: f32,
    pub col: [f32; 4], pub bus: [f32; 4], pub fila: f32, pub grilla: [f32; 4], pub tile: [f32; 2], pub cols: usize, pub gap: f32, pub pie: [f32; 4], pub chk: [f32; 4] }
pub fn geo(at: &Atlas, w: f32, h: f32, sel: usize) -> Geo {
    let c = hud_web::css(w, h); let u = aero::unidad(w, h); let (bo, ti) = (aero::BORDE * u, aero::ALTO_TITULO * u);
    // (casi toda la pantalla, como el de GMod: dos tercios de objetos y uno de herramientas)
    let (tot_w, tot_h) = ((1240.0 * c).min(w * 0.97), (560.0 * c).min(h * 0.96)); let (x, y) = ((w - tot_w) / 2.0, (h - tot_h) / 2.0);
    let sep = 8.0 * u; let tw = (tot_w * 0.33).clamp(230.0 * c, 380.0 * c); let sw = tot_w - tw - sep;
    let ven = [x, y, sw, tot_h]; let ven_h = [x + sw + sep, y, tw, tot_h];
    let caja = [x + bo, y + ti, sw - 2.0 * bo, tot_h - ti - bo]; let caja_h = [ven_h[0] + bo, y + ti, tw - 2.0 * bo, tot_h - ti - bo];
    let lw = (caja_h[2] * 0.42).round(); let lista_h = [caja_h[0], caja_h[1], lw, caja_h[3]]; let panel_h = [caja_h[0] + lw + 1.0, caja_h[1], caja_h[2] - lw - 1.0, caja_h[3]];
    // (las pestañas: como entran; si no, más juntas; si tampoco, las no elegidas sólo con el ícono)
    let th = 38.0 * c; let disp = caja[2] - 8.0 * c;
    let ancho = |f: f32, pad: f32, gap: f32, solo_ico: bool, s: &str| if solo_ico { 2.0 * pad + 18.0 * c } else { 2.0 * pad + 18.0 * c + gap + at.ancho(Cara::S4, f, 0.0, s) };
    let mut modo = 0; let mut anchos = vec![];
    for m in 0..3 { let (f, pad, gap) = if m == 0 { (15.0 * c, 13.0 * c, 8.0 * c) } else if m == 1 { (14.0 * c, 9.0 * c, 6.0 * c) } else { (14.0 * c, 11.0 * c, 7.0 * c) };
        anchos = VISIBLES.iter().map(|&i| ancho(f, pad, gap, m == 2 && i != sel, PESTANAS[i].0)).collect(); modo = m; if anchos.iter().sum::<f32>() <= disp { break; } }
    let (tab_f, tab_pad) = if modo == 0 { (15.0 * c, 13.0 * c) } else if modo == 1 { (14.0 * c, 9.0 * c) } else { (14.0 * c, 11.0 * c) };
    let mut tx = caja[0] + 4.0 * c; let tabs = anchos.iter().zip(VISIBLES.iter()).map(|(a, &i)| { let r = ([tx, caja[1], *a, th], !(modo == 2 && i != sel), i); tx += a; r }).collect();
    let pie_h = 36.0 * c; let y0 = caja[1] + th + 1.0 * c; let y1 = caja[1] + caja[3] - pie_h;
    let colw = 150.0 * c; let col = [caja[0], y0, colw, y1 - y0]; let bus = [caja[0] + 7.0 * c, y0 + 7.0 * c, colw - 14.0 * c, 32.0 * c];
    let grilla = [caja[0] + colw + 1.0 * c, y0, caja[2] - colw - 1.0 * c, y1 - y0]; let gap = 6.0 * c; let tile = [80.0 * c, (6.0 + 50.0 + 4.0 + 11.0 * 1.25 + 5.0) * c];
    let cols = (((grilla[2] - 16.0 * c + gap) / (tile[0] + gap)).floor() as usize).max(1);
    let pie = [caja[0], y1, caja[2], pie_h]; let chk = [caja[0] + 12.0 * c, y1 + (pie_h - 18.0 * c) / 2.0, 18.0 * c, 18.0 * c];
    Geo { c, u, ven, caja, cerrar: [ven[0] + ven[2] - bo - 50.0 * u, ven[1], 50.0 * u + bo, 28.0 * u], ven_h, caja_h, lista_h, panel_h, fila_h: 32.0 * c,
        tabs, tab_f, tab_pad, col, bus, fila: 34.0 * c, grilla, tile, cols, gap, pie, chk }
}
fn dentro(r: [f32; 4], x: f32, y: f32) -> bool { x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3] }

impl Juego {
    /// lo que hay en la grilla: la categoría elegida o, con algo buscado, lo que coincide en toda la pestaña
    pub(super) fn mo_items(&self) -> Vec<String> {
        let Some(mm) = &self.menu else { return vec![] }; let cat = self.cat(mm.pestana); let q = mm.q.trim().to_lowercase();
        if q.is_empty() { return cat.get(mm.sub).map(|s| s.1.clone()).unwrap_or_default(); }
        let mut v: Vec<String> = vec![];
        for (_, its) in cat.iter() { for it in its { if (self.mo_nombre(it) + " " + it).to_lowercase().contains(&q) && !v.contains(it) { v.push(it.clone()); } } }
        v
    }
    /// ¿es una categoría de las de JXMod (rb en DATA.menu)? (van con la viñeta verde, como la web)
    fn mo_cat_nueva(&self, pe: usize, n: &str) -> bool {
        let Some(paq) = &self.paq else { return false }; let tab = match pe { 0 => "Props", 2 => "Vehicles", _ => return false };
        paq.d["menu"].as_array().and_then(|a| a.iter().find(|c| c["n"].as_str() == Some(tab))).and_then(|c| c["sub"].as_array()).and_then(|ss| ss.iter().find(|s| s["n"].as_str() == Some(n))).map_or(false, |s| s["rb"].as_bool().unwrap_or(false) || s["rb"].as_f64().map_or(false, |x| x > 0.0))
    }
    /// ¿está puesto este ajuste del Mundo? (la hora elegida —la de ahora, si el tiempo está quieto— o el ciclo)
    fn mundo_activo(&self, it: &str) -> bool {
        if it == "mundo:ciclo" { return self.aj.ciclo; }
        it.strip_prefix("mundo:hora:").and_then(|x| x.parse::<f32>().ok()).map_or(false, |h| !self.aj.ciclo && (self.aj.hora - h).abs() < 0.01)
    }
    fn mo_nombre(&self, it: &str) -> String { npc::skin_de_item(it).map(|s| npc::skin_nom(s).to_string()).unwrap_or_else(|| self.jg.nombre_item(it).to_string()) }
    /// el menú, con el pincel (después del HUD)
    pub(super) fn mo_dibujar(&mut self, p: &mut Pincel, w: f32, h: f32) {
        self.mo_opc_paso();
        // (las herramientas ya no son una pestaña: tienen su ventana)
        if let Some(m) = self.menu.as_mut() { if m.pestana == PESTANA_HER { m.pestana = 0; m.sub = 0; } }
        let Some(mm) = self.menu.as_ref() else { return }; let (pe, sub, scroll, scroll_c, congelar) = (mm.pestana, mm.sub, mm.scroll, mm.scroll_cats, self.poner_congelado);
        let q = mm.q.clone(); let g = geo(p.at, w, h, pe); let c = g.c; let [x, y, bw, bh] = g.caja;
        p.rect(0.0, 0.0, w, h, [0.0, 0.0, 0.0, 0.3]);
        // ———— la ventana de objetos ————
        aero::ventana(p, g.ven, g.u, &OpVentana { titulo: "Menú de objetos", ico: Some("ico_props"), atras: false, cerrar: true, blanco: false, apretado: 0 });
        p.rect(x, y, bw, bh, FONDO); p.borde(x, y, bw, bh, 1.0, negro(0.6));
        let th = g.tabs[0].0[3]; let barra = aero::camino(x, y, bw, th, [0.0; 4]);
        p.degrade(&barra, true, y, y + th, &[(0.0, blanco(0.12)), (0.5, blanco(0.05)), (0.5, negro(0.08)), (1.0, negro(0.2))]);
        p.rect(x, y + th - 1.0, bw, 1.0, negro(0.6)); p.rect(x, y + th, bw, 1.0 * c, blanco(0.10));
        for (r, con_texto, i) in g.tabs.iter() {
            let s = *i == pe; if s { aero::boton_azul(p, [r[0] + 2.0, r[1] + 3.0, r[2] - 4.0, r[3] - 6.0], g.u, false); }
            let ix = r[0] + g.tab_pad; p.icono(PESTANAS[*i].1, ix, r[1] + (r[3] - 18.0 * c) / 2.0, 18.0 * c, 2.0, [1.0; 4]);
            if *con_texto { let f = g.tab_f; let base = p.at.base_centrada(Cara::S4, f, f, r[1], r[3]); if s { p.texto_sombra(Cara::S7, f, ix + 18.0 * c + 8.0 * c, base, NEG, PESTANAS[*i].0, 1.0); } else { p.texto(Cara::S4, f, ix + 18.0 * c + 8.0 * c, base, T2, 0.0, PESTANAS[*i].0); } }
        }
        // ---- la columna de la izquierda: el buscador y las categorías ----
        let col = g.col; p.rect(col[0], col[1], col[2], col[3], COLUMNA); p.rect(col[0] + col[2], col[1], 1.0 * c, col[3], LIN);
        let mut alto_c = 0.0;
        let filas: Vec<(String, bool, bool)> = self.cat(pe).iter().enumerate().map(|(k, (n, _))| (n.clone(), k == sub && q.is_empty(), self.mo_cat_nueva(pe, n))).collect();
        p.con_recorte(col, |p| {
            let mut yy = col[1] + 7.0 * c - scroll_c;
            let b = [g.bus[0], yy, g.bus[2], g.bus[3]]; let cb = aero::camino(b[0], b[1], b[2], b[3], [b[3] * 0.5; 4]);
            p.relleno(&cb, negro(0.4)); p.contorno(b[0], b[1], b[2], b[3], [b[3] * 0.5; 4], 1.0, blanco(0.18));
            p.icono("buscar", b[0] + 10.0 * c, b[1] + (b[3] - 14.0 * c) / 2.0, 14.0 * c, 2.2, T2);
            let (txt, cl) = if q.is_empty() { ("Buscar…".to_string(), T3) } else { (q.clone(), T1) }; p.texto_max(Cara::S4, 13.0 * c, b[0] + 30.0 * c, p.at.base_centrada(Cara::S4, 13.0 * c, 13.0 * c, b[1], b[3]), cl, 0.0, &txt, b[2] - 38.0 * c);
            yy += g.bus[3] + 7.0 * c;
            for (n, s, nueva) in &filas {
                let r = [col[0], yy, col[2], g.fila];
                if *s { aero::fila_vidrio(p, [r[0] + 4.0 * c, r[1] + 1.0 * c, r[2] - 8.0 * c, r[3] - 2.0 * c], g.u, true); }
                // (la viñeta: verde las categorías de JXMod —catNueva—, gris las demás)
                p.rect(r[0] + 13.0 * c, r[1] + (r[3] - 6.0 * c) / 2.0, 6.0 * c, 6.0 * c, if *nueva { rgba(0x5fc9a8, 1.0) } else { rgba(0x5b5c61, 1.0) });
                let f = 13.5 * c; p.texto_max(if *s { Cara::S7 } else { Cara::S4 }, f, r[0] + 27.0 * c, p.at.base_centrada(Cara::S4, f, f, r[1], r[3]), if *s { T1 } else { T2 }, 0.0, n, r[2] - 34.0 * c);
                yy += g.fila;
            }
            alto_c = yy + scroll_c - col[1] + 8.0 * c;
        });
        // ---- la grilla ----
        let gr = g.grilla; let mut alto_g = 0.0;
        {
            let items = self.mo_items(); let mm = self.menu.as_ref().unwrap(); let atlas_ok = mm.atlas_de == Some((pe, sub)) && mm.atlas_q == q; let ah = mm.atlas_h.max(1) as f32;
            p.con_recorte(gr, |p| {
                if items.is_empty() { p.texto(Cara::S4, 13.0 * c, gr[0] + 12.0 * c, gr[1] + 24.0 * c, T2, 0.0, "No hay resultados"); }
                for (k, it) in items.iter().enumerate() {
                    let (cx, fy) = (k % g.cols, k / g.cols); let r = [gr[0] + 8.0 * c + cx as f32 * (g.tile[0] + g.gap), gr[1] + 8.0 * c + fy as f32 * (g.tile[1] + g.gap) - scroll, g.tile[0], g.tile[1]];
                    if r[1] + r[3] < gr[1] || r[1] > gr[1] + gr[3] { continue; }
                    let mundo = crate::comun::jugabilidad::MUNDO.iter().find(|m| m.0 == it.as_str());
                    let opc = it.starts_with("opc:") || it.starts_with("agua:") || it.starts_with("mun:") || it.starts_with("tmod:") || mundo.is_some();
                    let on = match mundo { Some(m) => self.mundo_activo(m.0), None => opc && self.jg.activo(it.trim_start_matches("opc:")) };
                    tarjeta(p, r, if on { rgba(0x173a66, 1.0) } else { PL }); if on { p.contorno(r[0], r[1], r[2], r[3], [4.0 * c; 4], 2.0 * c, AMA); }
                    let (iw, ih) = (70.0 * c, 50.0 * c); let (ix, iy) = (r[0] + (r[2] - iw) / 2.0, r[1] + 6.0 * c);
                    if opc { p.icono(mundo.map_or(ico_opcion(it), |m| m.2), r[0] + (r[2] - ih) / 2.0, iy, ih, 2.0, [1.0; 4]);
                        let lc = [r[0] + r[2] - 10.0 * c, r[1] + 10.0 * c]; if on { p.disco(lc[0], lc[1], 7.0 * c, rgba(0x2f8ae8, 0.4)); } p.disco(lc[0], lc[1], 4.0 * c, if on { AMA } else { rgba(0x4a4b50, 1.0) }); }
                    else if atlas_ok { let (u0, v0) = ((k as u32 % ICO_COLS * ICO) as f32 / 1024.0, ((k as u32 / ICO_COLS) * ICO) as f32 / ah); let (u1, v1) = (u0 + ICO as f32 / 1024.0, v0 + ICO as f32 / ah);
                        let l = ih; let x0 = ix + (iw - l) / 2.0; p.quad(TEX_ICONOS, [[x0, iy], [x0 + l, iy], [x0 + l, iy + l], [x0, iy + l]], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], [[1.0; 4]; 4]); }
                    let f = 11.0 * c; p.texto_max(Cara::S4, f, r[0] + 4.0 * c, iy + ih + 4.0 * c + f, T1, 0.0, &self.mo_nombre(it), r[2] - 8.0 * c);
                }
                alto_g = (items.len().div_ceil(g.cols)) as f32 * (g.tile[1] + g.gap) + 16.0 * c;
            });
        }
        // ---- el pie: Congelado, o cómo se usan las Opciones ----
        let pi = g.pie; p.rect(pi[0], pi[1], pi[2], pi[3], BARRA); p.rect(pi[0], pi[1], pi[2], 1.0 * c, LIN);
        let opciones = q.is_empty() && self.cat(pe).get(sub).map_or(false, |s| s.0 == "Opciones");
        let mundo = q.is_empty() && self.cat(pe).get(sub).map_or(false, |s| s.0 == "Mundo");
        if opciones { p.texto_max(Cara::S4, 12.0 * c, pi[0] + 12.0 * c, p.at.base_centrada(Cara::S4, 12.0 * c, 12.0 * c, pi[1], pi[3]), T2, 0.0, "Tocá una para prenderla o apagarla (sirve en cualquier momento).", pi[2] - 24.0 * c); }
        else if mundo { let h = self.mj.dia.hora.rem_euclid(24.0); let t = format!("Ahora: {:02}:{:02}{} · tocá una hora para ponerla", h as u32, (h.fract() * 60.0) as u32, if self.aj.ciclo { " (el tiempo corre)" } else { "" });
            p.texto_max(Cara::S4, 12.0 * c, pi[0] + 12.0 * c, p.at.base_centrada(Cara::S4, 12.0 * c, 12.0 * c, pi[1], pi[3]), T2, 0.0, &t, pi[2] - 24.0 * c); }
        else { let k = g.chk; let s = k[2] / (16.0 * g.u); p.con(crate::pincel::escalar_en(s, s, k[0], k[1]), |p| aero::casilla(p, k[0], k[1], g.u, congelar, false));
            p.texto(Cara::S4, 13.5 * c, k[0] + k[2] + 9.0 * c, p.at.base_centrada(Cara::S4, 13.5 * c, 13.5 * c, pi[1], pi[3]), T1, 0.0, "Congelado"); }
        // ———— la ventana de herramientas ————
        aero::ventana(p, g.ven_h, g.u, &OpVentana { titulo: "Herramientas", ico: Some("ico_herr"), atras: false, cerrar: false, blanco: false, apretado: 0 });
        let ch = g.caja_h; p.rect(ch[0], ch[1], ch[2], ch[3], FONDO); p.borde(ch[0], ch[1], ch[2], ch[3], 1.0, negro(0.6));
        let lh = g.lista_h; p.rect(lh[0], lh[1], lh[2], lh[3], COLUMNA); p.rect(lh[0] + lh[2], lh[1], 1.0, lh[3], LIN);
        let sh = self.menu.as_ref().map_or(0.0, |m| m.scroll_her); let opc_sel = self.her.opc_sel;
        p.con_recorte(lh, |p| {
            let mut yy = lh[1] + 6.0 * c - sh;
            for (k, hh) in self.her.lista.iter().enumerate() {
                let r = [lh[0], yy, lh[2], g.fila_h]; let s = k == self.her.sel && opc_sel.is_none();
                if s { aero::fila_vidrio(p, [r[0] + 3.0 * c, r[1] + 1.0 * c, r[2] - 6.0 * c, r[3] - 2.0 * c], g.u, true); }
                p.icono("martillo", r[0] + 9.0 * c, r[1] + (r[3] - 13.0 * c) / 2.0, 13.0 * c, 2.2, if s { T1 } else { T3 });
                let f = 12.5 * c; p.texto_max(if s { Cara::S7 } else { Cara::S4 }, f, r[0] + 27.0 * c, p.at.base_centrada(Cara::S4, f, f, r[1], r[3]), if s { T1 } else { T2 }, 0.0, &hh.n, r[2] - 32.0 * c);
                yy += g.fila_h;
            }
            // (las opciones de los mods —spawnmenu.AddToolMenuOption: deslizarse, el cuerpo en primera persona…—, con su título)
            if !self.her.opc.is_empty() {
                let f = 11.0 * c; p.texto_max(Cara::S7, f, lh[0] + 9.0 * c, p.at.base_centrada(Cara::S7, f, f, yy, g.fila_h), AMA, 0.08, "OPCIONES DE LOS MODS", lh[2] - 18.0 * c); yy += g.fila_h;
                for (i, o) in self.her.opc.iter().enumerate() {
                    let r = [lh[0], yy, lh[2], g.fila_h]; let s = opc_sel == Some(i);
                    if s { aero::fila_vidrio(p, [r[0] + 3.0 * c, r[1] + 1.0 * c, r[2] - 6.0 * c, r[3] - 2.0 * c], g.u, true); }
                    p.icono("ico_mod", r[0] + 9.0 * c, r[1] + (r[3] - 13.0 * c) / 2.0, 13.0 * c, 2.2, if s { T1 } else { T3 });
                    let f = 12.5 * c; p.texto_max(if s { Cara::S7 } else { Cara::S4 }, f, r[0] + 27.0 * c, p.at.base_centrada(Cara::S4, f, f, r[1], r[3]), if s { T1 } else { T2 }, 0.0, &o.2, r[2] - 32.0 * c);
                    yy += g.fila_h;
                }
            }
        });
        let alto_insp = if opc_sel.is_some() { self.mo_inspector_opc(p, &g) } else { self.mo_inspector(p, &g); 0.0 };
        let filas = self.her.lista.len() + if self.her.opc.is_empty() { 0 } else { self.her.opc.len() + 1 };
        let max_her = (filas as f32 * g.fila_h + 12.0 * c - lh[3]).max(0.0);
        if let Some(mm) = self.menu.as_mut() { mm.insp_x0 = g.panel_h[0]; mm.max_insp = (alto_insp - g.panel_h[3]).max(0.0); mm.scroll_insp = mm.scroll_insp.min(mm.max_insp); }
        if let Some(mm) = self.menu.as_mut() { mm.her_x0 = g.ven_h[0]; mm.max_her = max_her; mm.scroll_her = mm.scroll_her.min(max_her); mm.col_x1 = col[0] + col[2]; mm.max_cats = (alto_c - col[3]).max(0.0); mm.max_scroll = (alto_g - gr[3]).max(0.0); mm.scroll = mm.scroll.min(mm.max_scroll); mm.scroll_cats = mm.scroll_cats.min(mm.max_cats); }
    }
    /// el panel de la herramienta elegida (el de la derecha): su nombre, la ayuda y cada parámetro con sus valores para tocar
    fn mo_inspector(&self, p: &mut Pincel, g: &Geo) {
        let Some(hh) = self.her.lista.get(self.her.sel) else { return }; let c = g.c; let pr = g.panel_h; let x = pr[0] + 9.0 * c; let mut y = pr[1] + 8.0 * c;
        p.texto_max(Cara::S7, 14.5 * c, x, y + 14.0 * c, T1, 0.0, &hh.n, pr[2] - 18.0 * c); y += 22.0 * c;
        for r in p.at.renglones(Cara::S4, 11.0 * c, 0.0, herramientas::ayuda(&hh.n), pr[2] - 18.0 * c).iter().take(4) { p.texto(Cara::S4, 11.0 * c, x, y + 11.0 * c, T2, 0.0, r); y += 14.0 * c; }
        let vals = self.her.params.get(&hh.n);
        for (pr_, cajas) in hh.p.iter().zip(self.mo_cajas_param(g)) {
            let v = vals.and_then(|m| m.get(&pr_.n)); let ops = self.valores_param(pr_, v);
            if let Some(b0) = cajas.first() { p.texto_max(Cara::S4, 12.0 * c, x, b0[1] - 5.0 * c, T2, 0.0, &pr_.n, pr[2] - 18.0 * c); }
            for (k, (o, b)) in ops.iter().zip(cajas.iter()).enumerate() {
                let s = match (pr_.t.as_str(), v) { ("String[]", Some(x)) => x.txt() == *o, ("Boolean", Some(x)) => x.si() == (k == 1), ("Single" | "Int32", _) => k == 1, _ => false };
                if s { aero::boton_azul(p, *b, c, false); } else { aero::boton_vidrio(p, *b, c, false, false); }
                let mut f = 12.5 * c; while p.at.ancho(Cara::S4, f, 0.0, o) > b[2] - 6.0 * c && f > 8.0 { f *= 0.92; }
                p.texto_c(Cara::S4, f, b[0] + b[2] / 2.0, p.at.base_centrada(Cara::S4, f, f, b[1], b[3]), if s { NEG } else { T1 }, 0.0, o);
            }
        }
    }
    /// dónde va cada control de la opción de un mod elegida: el renglón de su nombre (o los de la ayuda) y sus botones; y el alto
    /// de todo (para bajarlo con el dedo)
    fn mo_cajas_opc(&self, at: &Atlas, g: &Geo) -> (Vec<(f32, Vec<String>, Vec<[f32; 4]>)>, f32) {
        let c = g.c; let pr = g.panel_h; let x0 = pr[0] + 9.0 * c; let wv = pr[2] - 18.0 * c; let sc = self.menu.as_ref().map_or(0.0, |m| m.scroll_insp);
        let y0 = pr[1] + 8.0 * c + 38.0 * c; let mut y = y0 - sc; let fil = 30.0 * c; let mut v = vec![];
        let fila = |y: &mut f32, n: usize, por: usize| -> Vec<[f32; 4]> { let por = por.max(1); let bw = wv / por as f32; let r: Vec<[f32; 4]> = (0..n).map(|k| [x0 + (k % por) as f32 * bw, *y + (k / por) as f32 * (fil + 4.0 * c), bw - 4.0 * c, fil]).collect(); *y += n.div_ceil(por) as f32 * (fil + 4.0 * c); r };
        for ct in &self.her.opc_ctl {
            match ct {
                jxgmod::Control::Ayuda(t) => { let rs = at.renglones(Cara::S4, 11.0 * c, 0.0, t, wv); let n = rs.len().min(8); v.push((y + 11.0 * c, rs.into_iter().take(n).collect(), vec![])); y += n as f32 * 14.0 * c + 6.0 * c; }
                jxgmod::Control::Check { txt, .. } => { let ly = y + 11.0 * c; y += 16.0 * c; v.push((ly, vec![txt.clone()], fila(&mut y, 2, 2))); y += 6.0 * c; }
                jxgmod::Control::Slider { txt, .. } => { let ly = y + 11.0 * c; y += 16.0 * c; v.push((ly, vec![txt.clone()], fila(&mut y, 3, 3))); y += 6.0 * c; }
                jxgmod::Control::Combo { txt, ops, .. } => { let ly = y + 11.0 * c; y += 16.0 * c; v.push((ly, vec![txt.clone()], fila(&mut y, ops.len().max(1), 2))); y += 6.0 * c; }
                jxgmod::Control::Boton(_) => { v.push((y, vec![], fila(&mut y, 1, 1))); y += 6.0 * c; }
                jxgmod::Control::Texto { txt, .. } => { let ly = y + 11.0 * c; y += 16.0 * c; v.push((ly, vec![txt.clone()], fila(&mut y, 1, 1))); y += 6.0 * c; }
            }
        }
        (v, y + sc - y0 + 34.0 * c)
    }
    /// el panel de la derecha con una opción de un mod: su nombre y sus controles (casillas Sí/No, deslizadores −/+, listas,
    /// botones y textos) con los valores de sus ConVars; devuelve el alto de lo que tiene
    fn mo_inspector_opc(&self, p: &mut Pincel, g: &Geo) -> f32 {
        let Some(o) = self.her.opc_sel.and_then(|i| self.her.opc.get(i)) else { return 0.0 }; let c = g.c; let pr = g.panel_h; let x = pr[0] + 9.0 * c;
        let (cajas, alto) = self.mo_cajas_opc(p.at, g); let sc = self.menu.as_ref().map_or(0.0, |m| m.scroll_insp);
        p.con_recorte(pr, |p| {
            p.texto_max(Cara::S7, 14.5 * c, x, pr[1] + 22.0 * c - sc, T1, 0.0, &o.2, pr[2] - 18.0 * c);
            if !o.1.is_empty() { p.texto_max(Cara::S4, 10.5 * c, x, pr[1] + 34.0 * c - sc, T3, 0.0, &format!("{} · {}", o.1, o.3), pr[2] - 18.0 * c); }
            for (ct, (ly, renglones, bs)) in self.her.opc_ctl.iter().zip(cajas.iter()) {
                let ayuda = matches!(ct, jxgmod::Control::Ayuda(_));
                for (k, r) in renglones.iter().enumerate() { if r.is_empty() { continue; } p.texto_max(if ayuda { Cara::S4 } else { Cara::S7 }, if ayuda { 11.0 * c } else { 12.0 * c }, x, ly + k as f32 * 14.0 * c, if ayuda { T2 } else { T1 }, 0.0, r, pr[2] - 18.0 * c); }
                let etiquetas: Vec<(String, bool)> = match ct {
                    jxgmod::Control::Check { on, .. } => vec![("No".into(), !*on), ("Sí".into(), *on)],
                    jxgmod::Control::Slider { v, dec, .. } => vec![("−".into(), false), (format!("{:.*}", *dec as usize, v), true), ("+".into(), false)],
                    jxgmod::Control::Combo { ops, sel, .. } => ops.iter().enumerate().map(|(k, t)| (t.clone(), *sel == k + 1)).collect(),
                    jxgmod::Control::Boton(t) => vec![(t.clone(), false)],
                    jxgmod::Control::Texto { v, .. } => vec![(if v.is_empty() { "(tocar para escribir)".into() } else { v.clone() }, false)],
                    jxgmod::Control::Ayuda(_) => vec![],
                };
                for ((t, s), b) in etiquetas.iter().zip(bs.iter()) {
                    if *s { aero::boton_azul(p, *b, c, false); } else { aero::boton_vidrio(p, *b, c, false, false); }
                    let mut f = 12.5 * c; while p.at.ancho(Cara::S4, f, 0.0, t) > b[2] - 6.0 * c && f > 8.0 { f *= 0.92; }
                    p.texto_c(Cara::S4, f, b[0] + b[2] / 2.0, p.at.base_centrada(Cara::S4, f, f, b[1], b[3]), if *s { NEG } else { T1 }, 0.0, t);
                }
            }
            if self.her.opc_ctl.is_empty() { p.texto_max(Cara::S4, 11.0 * c, x, pr[1] + 52.0 * c - sc, T2, 0.0, "Este mod no tiene controles para tocar acá.", pr[2] - 18.0 * c); }
        });
        alto
    }
    /// un toque en el panel de una opción de un mod: la casilla se da vuelta, el deslizador sube o baja un veinteavo, la lista
    /// elige, el botón se aprieta, el texto abre el teclado; se guarda (como GMod guarda sus ConVars)
    fn mo_toque_opc(&mut self, x: f32, y: f32, g: &Geo) {
        let Some(i) = self.her.opc_sel else { return }; let Some(at) = self.ini.rec.atlas.as_ref() else { return };
        let (cajas, _) = self.mo_cajas_opc(at, g); let mut hecho = false;
        for (k, (ct, (_, _, bs))) in self.her.opc_ctl.clone().iter().zip(cajas.iter()).enumerate() {
            let Some(b) = bs.iter().position(|b| dentro(*b, x, y)) else { continue };
            let Some(gm) = self.gmod.gm.as_mut() else { return };
            match ct {
                jxgmod::Control::Check { on, .. } => { if (b == 1) != *on { gm.opcion_tocar_n(i, k, 0.0); } }
                jxgmod::Control::Slider { v, min, max, dec, .. } => { if b != 1 { let paso = ((max - min) / 20.0).max(if *dec == 0 { 1.0 } else { 10f64.powi(-(*dec as i32)) }); let n = if b == 0 { v - paso } else { v + paso }; gm.opcion_tocar_n(i, k, n.clamp(*min, *max)); } }
                jxgmod::Control::Combo { .. } => gm.opcion_tocar_n(i, k, b as f64 + 1.0),
                jxgmod::Control::Boton(_) => gm.opcion_tocar_n(i, k, 0.0),
                jxgmod::Control::Texto { txt, v } => { let (t, v) = (txt.clone(), v.clone()); self.pedir_texto(Escribir::OpcMod(i, k), if t.is_empty() { "Escribir" } else { &t }, &v, 200, false); return; }
                jxgmod::Control::Ayuda(_) => {}
            }
            hecho = true; break;
        }
        if hecho { if let Some(gm) = self.gmod.gm.as_mut() { self.her.opc_ctl = gm.opcion_leer(i); } self.opc_guardar(); }
    }
    /// (para las pruebas) dónde está la lista de herramientas: x, y, ancho, alto y el alto de cada fila
    pub fn mo_zona_lista(&self, w: f32, h: f32) -> Option<[f32; 5]> { let at = self.ini.rec.atlas.as_ref()?; let g = geo(at, w, h, 0); Some([g.lista_h[0], g.lista_h[1], g.lista_h[2], g.lista_h[3], g.fila_h]) }
    /// (para las pruebas) los botones de cada control de la opción elegida
    pub fn mo_cajas_opc_prueba(&self, w: f32, h: f32) -> Vec<(usize, Vec<[f32; 4]>)> { let Some(at) = self.ini.rec.atlas.as_ref() else { return vec![] }; let g = geo(at, w, h, 0); self.mo_cajas_opc(at, &g).0.into_iter().enumerate().map(|(k, x)| (k, x.2)).collect() }
    /// cada tanto con el menú abierto: la lista de opciones de los mods (llegan al cargarse cada uno) y los valores de la elegida
    pub(super) fn mo_opc_paso(&mut self) {
        self.her.opc_n += 1; if self.her.opc_n % 20 != 1 { return; }
        let Some(gm) = self.gmod.gm.as_mut() else { return };
        self.her.opc = gm.opciones_menu();
        if let Some(i) = self.her.opc_sel { if i >= self.her.opc.len() { self.her.opc_sel = None; } else { self.her.opc_ctl = gm.opcion_leer(i); } }
    }
    /// dónde van los valores de cada parámetro de la herramienta (un renglón por parámetro)
    fn mo_cajas_param(&self, g: &Geo) -> Vec<Vec<[f32; 4]>> {
        let Some(hh) = self.her.lista.get(self.her.sel) else { return vec![] }; let c = g.c; let pr = g.panel_h;
        // (debajo del nombre y la ayuda: cada parámetro con su nombre y sus valores, de a tres por renglón)
        let x0 = pr[0] + 9.0 * c; let wv = pr[2] - 18.0 * c; let mut y = pr[1] + 8.0 * c + 22.0 * c + 4.0 * 14.0 * c + 10.0 * c;
        hh.p.iter().map(|pr_| { let n = self.valores_param(pr_, self.her.params.get(&hh.n).and_then(|m| m.get(&pr_.n))).len().max(1);
            let por = n.min(3); let bw = wv / por as f32; let fil = 30.0 * c; y += 16.0 * c;
            let v: Vec<[f32; 4]> = (0..n).map(|k| [x0 + (k % por) as f32 * bw, y + (k / por) as f32 * (fil + 4.0 * c), bw - 4.0 * c, fil]).collect();
            y += n.div_ceil(por) as f32 * (fil + 4.0 * c) + 6.0 * c; v }).collect()
    }
    /// un toque con el menú abierto (estilo nuevo)
    pub(super) fn mo_toque(&mut self, x: f32, y: f32, w: f32, h: f32) {
        let Some(at) = self.ini.rec.atlas.as_ref() else { return }; let Some(mm) = self.menu.as_ref() else { return }; let g = geo(at, w, h, mm.pestana);
        // (la ventana de herramientas: elegir una —y tenerla en la mano— o tocar sus valores)
        if dentro(g.ven_h, x, y) {
            if dentro(g.lista_h, x, y) { let sh = self.menu.as_ref().map_or(0.0, |m| m.scroll_her); let k = ((y - g.lista_h[1] - 6.0 * g.c + sh) / g.fila_h).floor(); let n = self.her.lista.len();
                if k >= 0.0 && (k as usize) < n { self.her.sel = k as usize; self.her.opc_sel = None; self.equipar_herramienta(k as usize); }
                // (una opción de un mod: se arma su panel —con su función del Lua— y se ve a la derecha)
                else if k >= 0.0 && (k as usize) > n && (k as usize) - n - 1 < self.her.opc.len() { let i = k as usize - n - 1; self.her.opc_sel = Some(i); if let Some(m) = self.menu.as_mut() { m.scroll_insp = 0.0; }
                    if let Some(gm) = self.gmod.gm.as_mut() { self.her.opc_ctl = gm.opcion_armar(i); } } }
            else if dentro(g.panel_h, x, y) { if self.her.opc_sel.is_some() { self.mo_toque_opc(x, y, &g); } else { self.mo_toque_inspector(x, y, &g); } }
            return;
        }
        if !dentro(g.ven, x, y) || dentro(g.cerrar, x, y) { self.menu = None; return; }
        if !dentro(g.caja, x, y) { return; }
        for (r, _, i) in g.tabs.iter() { if dentro(*r, x, y) {
            if *i == PESTANA_MODS { self.menu = None; self.gmod_abrir(); return; }
            if let Some(m) = self.menu.as_mut() { if m.pestana != *i { m.pestana = *i; m.sub = 0; m.scroll = 0.0; m.scroll_cats = 0.0; m.q.clear(); } } return; } }
        let (pe, sc, scc) = { let m = self.menu.as_ref().unwrap(); (m.pestana, m.scroll, m.scroll_cats) };
        if dentro(g.col, x, y) {
            let mut yy = g.col[1] + 7.0 * g.c - scc;
            if y >= yy && y <= yy + g.bus[3] { let q = self.menu.as_ref().map(|m| m.q.clone()).unwrap_or_default(); self.pedir_texto(Escribir::Buscar, "Buscar", &q, 30, false); return; }
            yy += g.bus[3] + 7.0 * g.c;
            let k = ((y - yy) / g.fila).floor(); if k < 0.0 { return; } let k = k as usize;
            if k < self.cat(pe).len() { if let Some(m) = self.menu.as_mut() { m.sub = k; m.scroll = 0.0; m.q.clear(); } }
            return;
        }
        if dentro(g.pie, x, y) { if x <= g.chk[0] + 140.0 * g.c { self.poner_congelado = !self.poner_congelado; } return; }
        let gr = g.grilla; if !dentro(gr, x, y) { return; }
        let (cx, fy) = (((x - gr[0] - 8.0 * g.c) / (g.tile[0] + g.gap)).floor(), ((y - gr[1] - 8.0 * g.c + sc) / (g.tile[1] + g.gap)).floor());
        if cx < 0.0 || cx as usize >= g.cols || fy < 0.0 { return; }
        let i = fy as usize * g.cols + cx as usize;
        if let Some(n) = self.mo_items().get(i).cloned() { self.pendientes.push(n); }
    }
    fn mo_toque_inspector(&mut self, x: f32, y: f32, g: &Geo) {
        let Some(hh) = self.her.lista.get(self.her.sel) else { return }; let n = hh.n.clone(); let cajas = self.mo_cajas_param(g);
        let mut cambio: Option<(String, Valor)> = None;
        for (pr, cs) in hh.p.iter().zip(cajas.iter()) {
            let v = self.her.params.get(&n).and_then(|m| m.get(&pr.n)).cloned(); let ops = self.valores_param(pr, v.as_ref());
            for (k, b) in cs.iter().enumerate() {
                if !dentro(*b, x, y) || k >= ops.len() { continue; }
                cambio = Some((pr.n.clone(), match pr.t.as_str() {
                    "String[]" => Valor::Txt(ops[k].clone()), "Boolean" => Valor::Si(k == 1),
                    "Single" | "Int32" => { let x0 = v.as_ref().map(|x| x.num()).unwrap_or(0.0); let paso = if pr.t == "Int32" { 1.0 } else if x0.abs() >= 10.0 { 5.0 } else { 0.5 }; Valor::Num(match k { 0 => if pr.t == "Int32" { (x0 - paso).max(0.0) } else { x0 - paso }, 2 => x0 + paso, _ => x0 }) }
                    // (el nombre del objeto que tira el Spawner: va pasando por los del menú)
                    _ if pr.n == "Prop name" => { let todos: Vec<String> = std::iter::once("Crate".to_string()).chain(self.catalogo.iter().flat_map(|c| c.1.iter().cloned())).collect(); let i = todos.iter().position(|t| Some(t.as_str()) == v.as_ref().map(|x| x.txt()).as_deref()).map(|i| (i + 1) % todos.len()).unwrap_or(0); Valor::Txt(todos[i].clone()) }
                    _ => continue,
                }));
            }
        }
        if let Some((k, v)) = cambio { self.her.params.entry(n).or_default().insert(k, v); self.sonido.tocar("Click", 0.4, 1.0, None); }
    }
}

/// una tarjeta de la grilla: redondeada, del color pedido, con el brillo del vidrio arriba
fn tarjeta(p: &mut Pincel, r: [f32; 4], col: Col) {
    let ra = 4.0f32.min(r[3] * 0.1); let c = aero::camino(r[0], r[1], r[2], r[3], [ra; 4]);
    p.relleno(&c, col); p.degrade(&c, true, r[1], r[1] + r[3], &[(0.0, blanco(0.10)), (0.45, blanco(0.03)), (1.0, blanco(0.0))]);
    p.contorno(r[0], r[1], r[2], r[3], [ra; 4], 1.0, negro(0.5)); p.contorno(r[0] + 1.0, r[1] + 1.0, r[2] - 2.0, r[3] - 2.0, [(ra - 1.0).max(0.0); 4], 1.0, blanco(0.12));
}
