//! El menú de objetos (el de la web, #spawn, y la idea del menú de objetos de GMod: las pestañas arriba) en una ventana Aero
//! (aero.rs): el marco de vidrio con el título y la X roja; adentro, vidrio oscuro con las pestañas (su ícono de color y el
//! nombre; la elegida, azul con brillo; si no entran, más juntas y después sólo el ícono), la columna de la izquierda con el
//! buscador y las categorías (la elegida, la fila azul), la grilla de tarjetas de 84 px (el ícono y el nombre; las Opciones
//! con su luz de prendida) y el pie (Congelado, o cómo se usan las Opciones). En Herramientas, la lista y el inspector de la
//! herramienta. Todo con el pincel de los menús (pincel.rs).
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
fn ico_opcion(it: &str) -> &'static str { match it { "opc:volar" => "ico_volar", "opc:ragdoll" => "ico_ragdoll", "opc:scp" => "ico_scp", "opc:ciclope" => "ico_ciclope", _ => "ico_mod" } }

/// dónde va cada cosa (en px de la pantalla; las medidas de la web, en px de CSS, por css())
pub struct Geo { pub c: f32, /** la ventana entera (con el marco) */ pub ven: [f32; 4], pub u: f32, pub caja: [f32; 4], pub tabs: Vec<([f32; 4], bool)>, pub tab_f: f32, pub tab_pad: f32, pub cerrar: [f32; 4], pub col: [f32; 4], pub bus: [f32; 4], pub cats_y: f32, pub fila: f32,
    pub grilla: [f32; 4], pub tile: [f32; 2], pub cols: usize, pub gap: f32, pub pie: [f32; 4], pub chk: [f32; 4] }
pub fn geo(at: &Atlas, w: f32, h: f32, sel: usize) -> Geo {
    let c = hud_web::css(w, h); let u = aero::unidad(w, h); let (bo, ti) = (aero::BORDE * u, aero::ALTO_TITULO * u);
    let (bw, bh) = ((900.0 * c).min(w * 0.96 - 2.0 * bo), (500.0 * c).min(h * 0.96 - ti - bo));
    let ven = [(w - bw - 2.0 * bo) / 2.0, (h - bh - ti - bo) / 2.0, bw + 2.0 * bo, bh + ti + bo]; let (x, y) = (ven[0] + bo, ven[1] + ti);
    let th = 40.0 * c; let disp = bw;
    // (las pestañas: como entran; si no, más juntas; si tampoco, las no elegidas sólo con el ícono)
    let ancho = |f: f32, pad: f32, gap: f32, esp: f32, solo_ico: bool, s: &str| if solo_ico { 2.0 * pad + 18.0 * c } else { 2.0 * pad + 18.0 * c + gap + at.ancho(Cara::S4, f, esp, s) };
    let mut modo = 0; let mut anchos = vec![];
    for m in 0..3 { let (f, pad, gap, esp) = if m == 0 { (15.0 * c, 14.0 * c, 8.0 * c, 0.04) } else if m == 1 { (14.0 * c, 9.0 * c, 6.0 * c, 0.02) } else { (14.0 * c, 13.0 * c, 8.0 * c, 0.02) };
        anchos = PESTANAS.iter().enumerate().map(|(i, t)| ancho(f, pad, gap, esp, m == 2 && i != sel, t.0)).collect(); modo = m; if anchos.iter().sum::<f32>() <= disp { break; } }
    let (tab_f, tab_pad) = if modo == 0 { (15.0 * c, 14.0 * c) } else if modo == 1 { (14.0 * c, 9.0 * c) } else { (14.0 * c, 13.0 * c) };
    let mut tx = x; let tabs = anchos.iter().enumerate().map(|(i, a)| { let r = ([tx, y, *a, th], !(modo == 2 && i != sel)); tx += a; r }).collect();
    let pie_h = 40.0 * c; let y0 = y + th + 1.0 * c; let y1 = y + bh - pie_h;
    let colw = 172.0 * c; let col = [x, y0, colw, y1 - y0]; let bus = [x + 8.0 * c, y0 + 8.0 * c, colw - 16.0 * c, 36.0 * c];
    let grilla = [x + colw + 1.0 * c, y0, bw - colw - 1.0 * c, y1 - y0]; let gap = 6.0 * c; let tile = [84.0 * c, (6.0 + 54.0 + 4.0 + 11.0 * 1.25 + 5.0) * c];
    let cols = (((grilla[2] - 16.0 * c + gap) / (tile[0] + gap)).floor() as usize).max(1);
    let pie = [x, y1, bw, pie_h]; let chk = [x + 12.0 * c, y1 + (pie_h - 20.0 * c) / 2.0, 20.0 * c, 20.0 * c];
    Geo { c, ven, u, caja: [x, y, bw, bh], tabs, tab_f, tab_pad, cerrar: [ven[0] + ven[2] - bo - 50.0 * u, ven[1], 50.0 * u + bo, 28.0 * u], col, bus, cats_y: y0 + 8.0 * c + 36.0 * c + 8.0 * c, fila: 36.0 * c, grilla, tile, cols, gap, pie, chk }
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
    fn mo_nombre(&self, it: &str) -> String { npc::skin_de_item(it).map(|s| npc::skin_nom(s).to_string()).unwrap_or_else(|| self.jg.nombre_item(it).to_string()) }
    /// el menú, con el pincel (después del HUD)
    pub(super) fn mo_dibujar(&mut self, p: &mut Pincel, w: f32, h: f32) {
        let Some(mm) = self.menu.as_ref() else { return }; let (pe, sub, scroll, scroll_c, congelar) = (mm.pestana, mm.sub, mm.scroll, mm.scroll_cats, self.poner_congelado);
        let q = mm.q.clone(); let g = geo(p.at, w, h, pe); let c = g.c; let [x, y, bw, bh] = g.caja;
        p.rect(0.0, 0.0, w, h, [0.0, 0.0, 0.0, 0.3]);
        aero::ventana(p, g.ven, g.u, &OpVentana { titulo: "Menú de objetos", ico: Some("ico_props"), atras: false, cerrar: true, blanco: false, apretado: 0 });
        p.rect(x, y, bw, bh, FONDO); p.borde(x, y, bw, bh, 1.0, negro(0.6));
        // ---- las pestañas (la barra de vidrio de arriba) ----
        let th = g.tabs[0].0[3]; let barra = aero::camino(x, y, bw, th, [0.0; 4]);
        p.degrade(&barra, true, y, y + th, &[(0.0, blanco(0.12)), (0.5, blanco(0.05)), (0.5, negro(0.08)), (1.0, negro(0.2))]);
        p.rect(x, y + th - 1.0, bw, 1.0, negro(0.6)); p.rect(x, y + th, bw, 1.0 * c, blanco(0.10));
        for (i, (r, con_texto)) in g.tabs.iter().enumerate() {
            let s = i == pe; if s { let rb = [r[0] + 2.0, r[1] + 3.0, r[2] - 4.0, r[3] - 6.0]; aero::boton_azul(p, rb, g.u, false); }
            let ix = r[0] + g.tab_pad; p.icono(PESTANAS[i].1, ix, r[1] + (r[3] - 18.0 * c) / 2.0, 18.0 * c, 2.0, [1.0; 4]);
            if *con_texto { let f = g.tab_f; let base = p.at.base_centrada(Cara::S4, f, f, r[1], r[3]); if s { p.texto_sombra(Cara::S7, f, ix + 18.0 * c + 8.0 * c, base, NEG, PESTANAS[i].0, 1.0); } else { p.texto(Cara::S4, f, ix + 18.0 * c + 8.0 * c, base, T2, 0.0, PESTANAS[i].0); } }
        }
        // ---- la columna de la izquierda ----
        let col = g.col; p.rect(col[0], col[1], col[2], col[3], COLUMNA); p.rect(col[0] + col[2], col[1], 1.0 * c, col[3], LIN);
        let her = pe == PESTANA_HER; let mut alto_c = 0.0;
        let filas: Vec<(String, bool, bool)> = if her { self.her.lista.iter().enumerate().map(|(k, hh)| (hh.n.clone(), k == self.her.sel, false)).collect() }
            else { self.cat(pe).iter().enumerate().map(|(k, (n, _))| (n.clone(), k == sub && q.is_empty(), self.mo_cat_nueva(pe, n))).collect() };
        p.con_recorte(col, |p| {
            let mut yy = col[1] + 8.0 * c - scroll_c;
            if !her { let b = [g.bus[0], yy, g.bus[2], g.bus[3]]; p.rect(b[0], b[1], b[2], b[3], BARRA); p.borde(b[0], b[1], b[2], b[3], 1.0, LIN);
                p.icono("buscar", b[0] + 9.0 * c, b[1] + (b[3] - 15.0 * c) / 2.0, 15.0 * c, 2.2, T2);
                let (txt, cl) = if q.is_empty() { ("Buscar…".to_string(), T3) } else { (q.clone(), T1) }; p.texto_max(Cara::S4, 14.0 * c, b[0] + 31.0 * c, p.at.base_centrada(Cara::S4, 14.0 * c, 14.0 * c, b[1], b[3]), cl, 0.0, &txt, b[2] - 40.0 * c);
                yy += 36.0 * c + 8.0 * c; }
            for (n, s, nueva) in &filas {
                let r = [col[0], yy, col[2], g.fila];
                if *s { aero::fila_vidrio(p, [r[0] + 3.0 * c, r[1] + 1.0 * c, r[2] - 6.0 * c, r[3] - 2.0 * c], g.u, true); }
                // (la viñeta: verde las categorías de JXMod —catNueva—, gris las demás)
                p.rect(r[0] + 14.0 * c, r[1] + (r[3] - 6.0 * c) / 2.0, 6.0 * c, 6.0 * c, if *nueva { rgba(0x5fc9a8, 1.0) } else { rgba(0x5b5c61, 1.0) });
                let f = 14.0 * c; p.texto_max(if *s { Cara::S7 } else { Cara::S4 }, f, r[0] + 29.0 * c, p.at.base_centrada(Cara::S4, f, f, r[1], r[3]), if *s { T1 } else { T2 }, 0.0, n, r[2] - 36.0 * c);
                yy += g.fila;
            }
            alto_c = yy + scroll_c - col[1] + 8.0 * c;
        });
        // ---- la grilla (o, en Herramientas, el inspector) ----
        let gr = g.grilla; let mut alto_g = 0.0;
        if her { self.mo_inspector(p, &g); }
        else {
            let items = self.mo_items(); let mm = self.menu.as_ref().unwrap(); let atlas_ok = mm.atlas_de == Some((pe, sub)) && mm.atlas_q == q; let ah = mm.atlas_h.max(1) as f32;
            p.con_recorte(gr, |p| {
                if items.is_empty() { p.texto(Cara::S4, 13.0 * c, gr[0] + 12.0 * c, gr[1] + 24.0 * c, T2, 0.0, "No hay resultados"); }
                for (k, it) in items.iter().enumerate() {
                    let (cx, fy) = (k % g.cols, k / g.cols); let r = [gr[0] + 8.0 * c + cx as f32 * (g.tile[0] + g.gap), gr[1] + 8.0 * c + fy as f32 * (g.tile[1] + g.gap) - scroll, g.tile[0], g.tile[1]];
                    if r[1] + r[3] < gr[1] || r[1] > gr[1] + gr[3] { continue; }
                    let opc = it.starts_with("opc:"); let on = opc && self.jg.activo(it.trim_start_matches("opc:"));
                    tarjeta(p, r, if on { rgba(0x173a66, 1.0) } else { PL }); if on { p.contorno(r[0], r[1], r[2], r[3], [4.0 * c; 4], 2.0 * c, AMA); }
                    let (iw, ih) = (72.0 * c, 54.0 * c); let (ix, iy) = (r[0] + (r[2] - iw) / 2.0, r[1] + 6.0 * c);
                    if opc { p.icono(ico_opcion(it), r[0] + (r[2] - ih) / 2.0, iy, ih, 2.0, [1.0; 4]);
                        let lc = [r[0] + r[2] - 10.0 * c, r[1] + 10.0 * c]; if on { p.disco(lc[0], lc[1], 7.0 * c, rgba(0x2f8ae8, 0.4)); } p.disco(lc[0], lc[1], 4.0 * c, if on { AMA } else { rgba(0x4a4b50, 1.0) }); }
                    else if atlas_ok { let (u0, v0) = ((k as u32 % ICO_COLS * ICO) as f32 / 1024.0, ((k as u32 / ICO_COLS) * ICO) as f32 / ah); let (u1, v1) = (u0 + ICO as f32 / 1024.0, v0 + ICO as f32 / ah);
                        // (contain: el cuadrado del ícono en el rectángulo de 72 × 54)
                        let l = ih; let x0 = ix + (iw - l) / 2.0; p.quad(TEX_ICONOS, [[x0, iy], [x0 + l, iy], [x0 + l, iy + l], [x0, iy + l]], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], [[1.0; 4]; 4]); }
                    let f = 11.0 * c; p.texto_max(Cara::S4, f, r[0] + 4.0 * c, iy + ih + 4.0 * c + f, T1, 0.0, &self.mo_nombre(it), r[2] - 8.0 * c);
                }
                alto_g = (items.len().div_ceil(g.cols)) as f32 * (g.tile[1] + g.gap) + 16.0 * c;
            });
        }
        // ---- el pie: Congelado, o cómo se usan las Opciones ----
        let pi = g.pie; p.rect(pi[0], pi[1], pi[2], pi[3], BARRA); p.rect(pi[0], pi[1], pi[2], 1.0 * c, LIN);
        let opciones = !her && q.is_empty() && self.cat(pe).get(sub).map_or(false, |s| s.0 == "Opciones");
        if opciones { p.texto_max(Cara::S4, 12.0 * c, pi[0] + 12.0 * c, p.at.base_centrada(Cara::S4, 12.0 * c, 12.0 * c, pi[1], pi[3]), T2, 0.0, "Tocá una para prenderla o apagarla (sirve en cualquier momento).", pi[2] - 24.0 * c); }
        else if !her { let k = g.chk; let s = k[2] / (16.0 * g.u); p.con(crate::pincel::escalar_en(s, s, k[0], k[1]), |p| aero::casilla(p, k[0], k[1], g.u, congelar, false));
            p.texto(Cara::S4, 14.0 * c, k[0] + k[2] + 9.0 * c, p.at.base_centrada(Cara::S4, 14.0 * c, 14.0 * c, pi[1], pi[3]), T1, 0.0, "Congelado"); }
        if let Some(mm) = self.menu.as_mut() { mm.col_x1 = col[0] + col[2]; mm.max_cats = (alto_c - col[3]).max(0.0); mm.max_scroll = (alto_g - gr[3]).max(0.0); mm.scroll = mm.scroll.min(mm.max_scroll); mm.scroll_cats = mm.scroll_cats.min(mm.max_cats); }
    }
    /// el inspector de la herramienta elegida: su nombre, la ayuda y cada parámetro con sus valores para tocar
    fn mo_inspector(&self, p: &mut Pincel, g: &Geo) {
        let Some(hh) = self.her.lista.get(self.her.sel) else { return }; let c = g.c; let gr = g.grilla; let x = gr[0] + 14.0 * c; let mut y = gr[1] + 14.0 * c;
        p.texto(Cara::S7, 16.0 * c, x, y + 16.0 * c, T1, 0.0, &format!("Tool Gun: {}", hh.n)); y += 26.0 * c;
        for r in p.at.renglones(Cara::S4, 12.0 * c, 0.0, herramientas::ayuda(&hh.n), gr[2] - 28.0 * c) { p.texto(Cara::S4, 12.0 * c, x, y + 12.0 * c, T2, 0.0, &r); y += 16.0 * c; }
        y += 8.0 * c; let vals = self.her.params.get(&hh.n);
        for (f, (pr, cajas)) in hh.p.iter().zip(self.mo_cajas_param(g)).enumerate() {
            let v = vals.and_then(|m| m.get(&pr.n)); let ops = self.valores_param(pr, v); let _ = f;
            if let Some(b0) = cajas.first() { p.texto_max(Cara::S4, 13.0 * c, x, p.at.base_centrada(Cara::S4, 13.0 * c, 13.0 * c, b0[1], b0[3]), T1, 0.0, &pr.n, b0[0] - x - 8.0 * c); }
            for (k, (o, b)) in ops.iter().zip(cajas.iter()).enumerate() {
                let s = match (pr.t.as_str(), v) { ("String[]", Some(x)) => x.txt() == *o, ("Boolean", Some(x)) => x.si() == (k == 1), ("Single" | "Int32", _) => k == 1, _ => false };
                if s { aero::boton_azul(p, *b, c, false); } else { aero::boton_vidrio(p, *b, c, false, false); }
                let mut f = 13.0 * c; while p.at.ancho(Cara::S4, f, 0.0, o) > b[2] - 6.0 * c && f > 8.0 { f *= 0.92; }
                p.texto_c(Cara::S4, f, b[0] + b[2] / 2.0, p.at.base_centrada(Cara::S4, f, f, b[1], b[3]), if s { NEG } else { T1 }, 0.0, o);
            }
            let _ = y;
        }
    }
    /// dónde van los valores de cada parámetro de la herramienta (un renglón por parámetro)
    fn mo_cajas_param(&self, g: &Geo) -> Vec<Vec<[f32; 4]>> {
        let Some(hh) = self.her.lista.get(self.her.sel) else { return vec![] }; let c = g.c; let gr = g.grilla;
        let y0 = gr[1] + 14.0 * c + 26.0 * c + 16.0 * c * 2.0 + 8.0 * c; let fila = 44.0 * c; let x0 = gr[0] + 14.0 * c + 150.0 * c; let wv = gr[0] + gr[2] - 14.0 * c - x0;
        hh.p.iter().enumerate().map(|(f, pr)| { let n = self.valores_param(pr, self.her.params.get(&hh.n).and_then(|m| m.get(&pr.n))).len().max(1); let bw = (wv / n as f32).min(110.0 * c);
            (0..n).map(|k| [x0 + k as f32 * bw, y0 + f as f32 * fila, bw - 3.0 * c, fila - 6.0 * c]).collect() }).collect()
    }
    /// un toque con el menú abierto (estilo nuevo)
    pub(super) fn mo_toque(&mut self, x: f32, y: f32, w: f32, h: f32) {
        let Some(at) = self.ini.rec.atlas.as_ref() else { return }; let Some(mm) = self.menu.as_ref() else { return }; let g = geo(at, w, h, mm.pestana);
        if !dentro(g.ven, x, y) || dentro(g.cerrar, x, y) { self.menu = None; return; }
        if !dentro(g.caja, x, y) { return; }
        for (i, (r, _)) in g.tabs.iter().enumerate() { if dentro(*r, x, y) {
            if i == PESTANA_MODS { self.menu = None; self.gmod_abrir(); return; }
            let her = self.her.sel; if let Some(m) = self.menu.as_mut() { if m.pestana != i { m.pestana = i; m.sub = if i == PESTANA_HER { her } else { 0 }; m.scroll = 0.0; m.scroll_cats = 0.0; m.q.clear(); } } return; } }
        let (pe, sub, sc, scc) = { let m = self.menu.as_ref().unwrap(); (m.pestana, m.sub, m.scroll, m.scroll_cats) }; let her = pe == PESTANA_HER;
        if dentro(g.col, x, y) {
            let mut yy = g.col[1] + 8.0 * g.c - scc;
            if !her { if y >= yy && y <= yy + g.bus[3] { let q = self.menu.as_ref().map(|m| m.q.clone()).unwrap_or_default(); self.pedir_texto(Escribir::Buscar, "Buscar", &q, 30, false); return; } yy += 44.0 * g.c; }
            let k = ((y - yy) / g.fila).floor(); if k < 0.0 { return; } let k = k as usize;
            if her { if k < self.her.lista.len() { if let Some(m) = self.menu.as_mut() { m.sub = k; } self.equipar_herramienta(k); } }
            else if k < self.cat(pe).len() { if let Some(m) = self.menu.as_mut() { m.sub = k; m.scroll = 0.0; m.q.clear(); } }
            return;
        }
        if dentro(g.pie, x, y) { if !her && x <= g.chk[0] + 140.0 * g.c { self.poner_congelado = !self.poner_congelado; } return; }
        if her { self.mo_toque_inspector(x, y, &g); return; }
        let gr = g.grilla; let (cx, fy) = (((x - gr[0] - 8.0 * g.c) / (g.tile[0] + g.gap)).floor(), ((y - gr[1] - 8.0 * g.c + sc) / (g.tile[1] + g.gap)).floor());
        if cx < 0.0 || cx as usize >= g.cols || fy < 0.0 { return; }
        let i = fy as usize * g.cols + cx as usize; let _ = sub;
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
