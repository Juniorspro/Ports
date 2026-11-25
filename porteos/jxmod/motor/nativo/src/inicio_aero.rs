//! El inicio nuevo del nativo (Aero): la idea del menú de GMod —el logo arriba a la izquierda y la lista de opciones en letras
//! blancas grandes, por grupos— con el vidrio de aero.rs: la fila apretada de vidrio, los paneles de la derecha (las novedades
//! y el evento) y la barra de tareas de vidrio negro abajo (el orbe, los botones y el área de avisos con tu nombre, Discord,
//! TikTok y la versión con la fecha, donde va el reloj)
use super::*;
use super::aero::{self, blanco, negro, Aero, BLANCO};
use super::inicio_juego::{prog, Nivel, Pieza, CL_TXT};
use crate::pincel::{Cara, Pincel};
use std::sync::OnceLock;

/// los grupos de la lista (como los del menú de GMod: jugar, lo demás, las opciones y salir)
const GRUPO: [usize; 8] = [0, 0, 1, 1, 1, 1, 2, 3];

/// la nota más nueva de novedades.js (versión, fecha y texto), leída una vez
fn ultima_nota() -> &'static (String, String, String) {
    static N: OnceLock<(String, String, String)> = OnceLock::new();
    N.get_or_init(|| super::paneles_juego::novedades().into_iter().next().map(|n| (n.v, n.f, n.es)).unwrap_or_default())
}

impl Juego {
    /// el inicio: dibuja y devuelve lo que se toca (lo último va encima)
    pub(super) fn aero_home(&self, p: &mut Pincel, w: f32, h: f32) -> Vec<([f32; 4], Pieza)> {
        let u = aero::unidad(w, h); let ini = &self.ini; let ins = ini.ins;
        let t = ini.reloj - ini.entrada; let anim = ini.nivel != Nivel::Quieto;
        let ent = |d: f32, dur: f32| if anim { let k = prog(t, d, dur); 1.0 - (1.0 - k).powi(3) } else { 1.0 };
        let apr = |pz: Pieza| ini.apretado == Some(pz);
        let mut z: Vec<([f32; 4], Pieza)> = vec![];
        let x0 = ins[0] + 30.0 * u; let y_top = ins[2] + 16.0 * u;
        let tb = 34.0 * u; let y_tb = h - ins[3] - tb;

        // —— el logo ——
        let alto_logo = 54.0 * u;
        if let Some((id, lw, lh)) = self.ini_foto("logo") {
            let k = ent(0.0, 0.5); let an = alto_logo * lw / lh;
            p.con_alfa(k, |p| { p.nube(x0 + an * 0.1, y_top + alto_logo * 0.3, an * 0.8, alto_logo * 0.4, 26.0 * u, negro(0.3), true);
                p.foto(id, x0 - 2.0 * u, y_top - (1.0 - k) * 8.0 * u, an, alto_logo, BLANCO); });
        }

        // —— la lista (si no entra en pantallas bajas, más apretada) ——
        let (mut fila, mut hueco, mut tam) = (25.0 * u, 9.0 * u, 17.5 * u);
        let y_lista = y_top + alto_logo + 14.0 * u; let disp = y_tb - 8.0 * u - y_lista; let total = 8.0 * fila + 3.0 * hueco;
        if total > disp { let k = (disp / total).max(0.7); fila *= k; hueco *= k; tam *= k.max(0.86); }
        let mut y = y_lista; let mut ancho_lista = 0.0f32;
        for i in 0..8 {
            if i > 0 && GRUPO[i] != GRUPO[i - 1] { y += hueco; }
            let txt = CL_TXT[i]; let tw = p.at.ancho(Cara::S4, tam, 0.0, txt); ancho_lista = ancho_lista.max(tw);
            let k = ent(0.12 + i as f32 * 0.045, 0.35); let a = apr(Pieza::Op(i));
            let dx = (1.0 - k) * -26.0 * u + if a { 3.0 * u } else { 0.0 };
            let r = [x0 - 10.0 * u + dx, y, tw + 20.0 * u, fila];
            p.con_alfa(k, |p| {
                if a { aero::fila_vidrio(p, r, u, true); }
                let base = p.at.base_centrada(Cara::S4, tam, fila, y, fila);
                p.texto_sombra(Cara::S4, tam, x0 + dx, base, BLANCO, txt, 1.4 * u);
            });
            z.push(([x0 - 14.0 * u, y, tw + 50.0 * u, fila], Pieza::Op(i)));
            y += fila;
        }

        // —— los paneles de la derecha: las novedades y el evento ——
        let gw = 206.0 * u; let gx = w - ins[1] - 16.0 * u - gw;
        if gx > x0 + ancho_lista + 40.0 * u {
            let mut gy = y_top; let k = ent(0.3, 0.45); let dx = (1.0 - k) * 30.0 * u;
            let (v, f, es) = ultima_nota();
            if !es.is_empty() {
                let tl = 11.5 * u; let lh = 14.5 * u; let ancho_t = gw - 22.0 * u;
                let todas = p.at.renglones(Cara::S4, tl, 0.0, es, ancho_t);
                let max_l = (((y_tb - 70.0 * u - gy - 34.0 * u - 18.0 * u) / lh).floor() as usize).clamp(2, 7);
                let mut ls: Vec<String> = todas.iter().take(max_l).cloned().collect();
                if todas.len() > max_l { if let Some(l) = ls.last_mut() { while !l.is_empty() && p.at.ancho(Cara::S4, tl, 0.0, &format!("{l}…")) > ancho_t { l.pop(); } l.push('…'); } }
                let gh = 30.0 * u + ls.len() as f32 * lh + 22.0 * u; let r = [gx + dx, gy, gw, gh];
                p.con_alfa(k, |p| {
                    aero::tarjeta(p, r, u, apr(Pieza::Novedades));
                    p.icono("estrella", r[0] + 10.0 * u, gy + 8.0 * u, 14.0 * u, 2.2, aero::hex(0xffd84d));
                    p.texto_sombra(Cara::S7, 12.5 * u, r[0] + 30.0 * u, gy + 19.5 * u, BLANCO, "Novedades", u);
                    p.texto_d(Cara::S4, 11.0 * u, r[0] + gw - 10.0 * u, gy + 19.5 * u, blanco(0.72), 0.0, &format!("v{v}"));
                    p.rect(r[0] + 10.0 * u, gy + 27.0 * u, gw - 20.0 * u, (0.75 * u).max(1.0), blanco(0.22));
                    for (i, l) in ls.iter().enumerate() { p.texto(Cara::S4, tl, r[0] + 11.0 * u, gy + 42.0 * u + i as f32 * lh, blanco(0.92), 0.0, l); }
                    let fecha = { let q: Vec<&str> = f.split('-').collect(); if q.len() == 3 { format!("{}/{}", q[2], q[1]) } else { f.clone() } };
                    p.texto(Cara::S4, 10.5 * u, r[0] + 11.0 * u, gy + gh - 9.0 * u, blanco(0.6), 0.0, &fecha);
                    p.icono("adelante", r[0] + gw - 21.0 * u, gy + gh - 19.5 * u, 12.0 * u, 2.6, aero::hex(0x9fd6ff));
                    p.texto_d(Cara::S4, 11.0 * u, r[0] + gw - 23.0 * u, gy + gh - 9.0 * u, aero::hex(0x9fd6ff), 0.0, "Ver todo");
                });
                z.push((r, Pieza::Novedades)); gy += gh + 10.0 * u;
            }
            let gh = 46.0 * u;
            if gy + gh < y_tb - 8.0 * u {
                let r = [gx + dx, gy, gw, gh];
                p.con_alfa(k, |p| {
                    aero::tarjeta(p, r, u, apr(Pieza::Grieta));
                    p.icono("rayo", r[0] + 11.0 * u, gy + (gh - 22.0 * u) / 2.0, 22.0 * u, 2.2, aero::hex(0xffb347));
                    p.texto_sombra(Cara::S7, 12.5 * u, r[0] + 42.0 * u, gy + 20.0 * u, BLANCO, "Evento: La grieta", u);
                    p.texto(Cara::S4, 11.0 * u, r[0] + 42.0 * u, gy + 35.0 * u, blanco(0.78), 0.0, "Algo cae del cielo…");
                });
                z.push((r, Pieza::Grieta));
            }
        }

        // —— la barra de tareas ——
        aero::barra_tareas(p, [0.0, y_tb, w, h - y_tb], u);
        let (ocx, ocy, ora) = (ins[0] + 25.0 * u, y_tb + tb / 2.0 - 1.5 * u, 17.0 * u);
        // (el orbe: las novedades)
        aero::orbe(p, ocx, ocy, ora, u, apr(Pieza::Novedades));
        z.push(([ocx - ora - 6.0 * u, y_tb, ora * 2.0 + 12.0 * u, tb], Pieza::Novedades));
        // (el área de avisos de la derecha: tu nombre, Discord, TikTok y la versión con la fecha)
        let g = (0.75 * u).max(1.0); let tn = 11.5 * u;
        let nombre = self.en_red.red.nombre.clone(); let nombre = if nombre.trim().is_empty() { "Tu nombre".to_string() } else { nombre };
        let nw = 14.0 * u + 6.0 * u + p.at.ancho(Cara::S4, tn, 0.0, &nombre).min(110.0 * u) + 16.0 * u;
        let (v, _, _) = ultima_nota(); let ver = format!("v{}", if v.is_empty() { ini.version.as_str() } else { v.as_str() });
        let rw = p.at.ancho(Cara::S4, tn, 0.0, &ver).max(p.at.ancho(Cara::S4, 10.5 * u, 0.0, &ini.armado)) + 20.0 * u;
        let area_w = nw + 2.0 * 28.0 * u + rw + 8.0 * u; let ax = w - ins[1] - area_w;
        p.rect(ax, y_tb + 2.0 * g, area_w + ins[1], tb - 2.0 * g, negro(0.22)); p.rect(ax, y_tb + 2.0 * g, g, tb - 2.0 * g, negro(0.5)); p.rect(ax + g, y_tb + 2.0 * g, g, tb - 2.0 * g, blanco(0.16));
        let mut cx = ax + 4.0 * u; let bh = 26.0 * u; let by = y_tb + (tb - bh) / 2.0 + 0.5 * u;
        let rn = [cx, by, nw, bh]; if apr(Pieza::Nombre) { aero::boton_vidrio(p, rn, u, true, false); }
        p.icono("persona", cx + 8.0 * u, by + (bh - 14.0 * u) / 2.0, 14.0 * u, 2.2, BLANCO);
        p.texto_max(Cara::S4, tn, cx + 28.0 * u, p.at.base_centrada(Cara::S4, tn, bh, by, bh), BLANCO, 0.0, &nombre, 110.0 * u);
        z.push((rn, Pieza::Nombre)); cx += nw;
        for (pz, ico) in [(Pieza::Discord, "discord"), (Pieza::TikTok, "tiktok")] {
            let r = [cx, by, 28.0 * u, bh]; if apr(pz) { aero::boton_vidrio(p, r, u, true, false); }
            p.icono(ico, cx + 6.0 * u, by + (bh - 16.0 * u) / 2.0, 16.0 * u, 2.2, BLANCO); z.push((r, pz)); cx += 28.0 * u;
        }
        let rx = cx + 4.0 * u + rw / 2.0;
        p.texto_c(Cara::S4, tn, rx, y_tb + tb * 0.45, BLANCO, 0.0, &ver);
        p.texto_c(Cara::S4, 10.5 * u, rx, y_tb + tb * 0.83, blanco(0.78), 0.0, &ini.armado);
        // (los botones: con el texto si entran; si no, sólo el ícono)
        let bt: [(Pieza, &'static str, &str); 4] = [(Pieza::Contenido, "ico_gmod", "Contenido de GMod"), (Pieza::Avisos, "campana", "Avisos"), (Pieza::Bugs, "bicho", "Bugs y sugerencias"), (Pieza::Idioma, "mundo", "Idioma")];
        let tbt = 12.0 * u; let x_b = ocx + ora + 12.0 * u; let disp = ax - 8.0 * u - x_b;
        let anchos: Vec<f32> = bt.iter().map(|b| 16.0 * u + 7.0 * u + p.at.ancho(Cara::S4, tbt, 0.0, b.2) + 20.0 * u).collect();
        let solo_ico = anchos.iter().sum::<f32>() + 4.0 * u * 3.0 > disp;
        let mut bx = x_b;
        for (i, (pz, ico, txt)) in bt.iter().enumerate() {
            let bw = if solo_ico { 36.0 * u } else { anchos[i] }; let r = [bx, by, bw, bh];
            aero::boton_vidrio(p, r, u, apr(*pz), false);
            let ix = if solo_ico { bx + (bw - 16.0 * u) / 2.0 } else { bx + 10.0 * u };
            p.icono(ico, ix, by + (bh - 16.0 * u) / 2.0, 16.0 * u, 2.2, BLANCO);
            if !solo_ico { p.texto_sombra(Cara::S4, tbt, bx + 33.0 * u, p.at.base_centrada(Cara::S4, tbt, bh, by, bh), BLANCO, txt, u); }
            z.push((r, *pz)); bx += bw + 4.0 * u;
        }
        z
    }
}
