//! surface y draw: la HUD de los addons como órdenes de dibujo 2D para el juego (gmaApiDibujo de la web).

use crate::anfitrion::{Cmd2D, Rgba};
use crate::mates::RAD;
use crate::nucleo::*;
use jxlua::{Error, Estado, Valor};

type R = Result<(), Error>;

/// Math.round de JavaScript
fn jround(x: f64) -> f64 { (x + 0.5).floor() }
/// una fuente CSS como las arma la web (sin métricas propias: el alto es el tamaño)
fn hacer_fuente(fam: &str, sz: f64, w: f64, ital: bool) -> String {
    let h = jmax(6.0, jround(sz));
    let px = jxlua::numeros::js_tostring(jxlua::numeros::to_fixed(h, 2).parse::<f64>().unwrap_or(h));
    format!("{}{} {}px \"{}\", Tahoma, sans-serif", if ital { "italic " } else { "" }, if w >= 600.0 { "bold" } else { "normal" }, px, fam)
}
/// el alto de una fuente (fAlto)
fn f_alto(css: &str) -> f64 {
    let px = primer_px(css).unwrap_or(f64::NAN);
    let v = jround(if px.is_nan() || px == 0.0 { 13.0 } else { px });
    if v.is_nan() || v == 0.0 { 13.0 } else { v }
}
fn primer_px(css: &str) -> Option<f64> {
    let b = css.as_bytes();
    let mut i = 0;
    while i < b.len() {
        if b[i].is_ascii_digit() || b[i] == b'.' {
            let ini = i;
            while i < b.len() && (b[i].is_ascii_digit() || b[i] == b'.') { i += 1; }
            if b[i..].starts_with(b"px") { return jxlua::numeros::js_texto_a_numero(&b[ini..i]).into(); }
        } else { i += 1; }
    }
    None
}
fn fuente(n: &str) -> String { g(|g| g.fuentes.get(n).cloned().or_else(|| g.fuentes.get("DermaDefault").cloned()).unwrap_or_default()) }
/// el ancho de un texto (recordado, como gmAncho)
pub(crate) fn ancho(css: &str, s: &str) -> f64 {
    let k = format!("{}\u{1}{}", css, s);
    if let Some(w) = g(|g| g.ancho_cache.get(&k).copied()) { return w; }
    let w = h(|h| h.ancho_texto(css, s));
    g(|g| { if g.ancho_cache.len() > 4000 { g.ancho_cache.clear(); } g.ancho_cache.insert(k, w); });
    w
}
/// el lienzo de la HUD (cuenta lo que se dibuja en este cuadro)
fn lienzo() { g(|g| if g.dibujo_hud { g.hud_n += 1; }); }
fn d2(c: Cmd2D) { h(|h| h.dibujar_2d(c)); }
/// rgba(): r, g, b enteros y el alfa de 0 a 1
fn rgba(c: [f64; 4]) -> Rgba { [i32_de(c[0]) as f64, i32_de(c[1]) as f64, i32_de(c[2]) as f64, c[3] / 255.0] }
/// col(): un Color o r, g, b, a
fn col(a: &[Valor]) -> [f64; 4] {
    let r = ar(a, 0);
    if let Valor::Tabla(t) = &r {
        let gk = |k: &str| { let v = tget(t, k); if v.es_nil() { 255.0 } else { mas(&v) } };
        return [gk("r"), gk("g"), gk("b"), gk("a")];
    }
    let al = ar(a, 3);
    [num(&r, 255.0), num(&ar(a, 1), 255.0), num(&ar(a, 2), 255.0), if al.es_nil() { 255.0 } else { num(&al, 255.0) }]
}
fn texto_de(v: &Valor) -> String { if v.es_nil() { String::new() } else { js_str(v) } }
fn alinear(x: f64, y: f64, w: f64, hh: f64, xa: &Valor, ya: &Valor) -> (f64, f64) {
    let es = |v: &Valor, n: f64| matches!(v, Valor::Num(x) if *x == n);
    (if es(xa, 1.0) { x - w / 2.0 } else if es(xa, 2.0) { x - w } else { x }, if es(ya, 1.0) { y - hh / 2.0 } else if es(ya, 4.0) { y - hh } else { y })
}
/// un texto alineado, con borde si hace falta (texto() de la web): devuelve el ancho y el alto
fn texto(t: &Valor, f: &Valor, x: &Valor, y: &Valor, c: &Valor, xa: &Valor, ya: &Valor, borde: f64, cb: &Valor) -> (f64, f64) {
    lienzo();
    let css = fuente(&js_str(f));
    let s = texto_de(t);
    let w = ancho(&css, &s);
    let hh = f_alto(&css);
    let (px, py) = alinear(num(x, 0.0), num(y, 0.0), w, hh, xa, ya);
    if borde != 0.0 && !borde.is_nan() { d2(Cmd2D::TextoBorde { s: s.clone(), x: px, y: py, fuente: css.clone(), color: rgba(col(std::slice::from_ref(cb))), ancho: borde * 2.0 }); }
    let color = if js_t(c) { rgba(col(std::slice::from_ref(c))) } else { rgba([255.0; 4]) };
    d2(Cmd2D::Texto { s, x: px, y: py, fuente: css, color, base: "top".into() });
    (w, hh)
}
/// un rectángulo con la textura puesta (o del color, si no tiene imagen)
fn tex(x: f64, y: f64, w: f64, hh: f64) {
    lienzo();
    let (m, col) = g(|g| (g.dib.mat.clone(), g.dib.col));
    let info = crate::resto::mat_info(&m);
    if let Some((nombre, i)) = &info {
        if i.cargado {
            d2(Cmd2D::Imagen { material: nombre.clone(), x, y, w, h: hh, recorte: [0.0, 0.0, i.ancho, i.alto], alfa: col[3] / 255.0 });
            return;
        }
        if i.nada { return; }
    }
    d2(Cmd2D::Rect { x, y, w, h: hh, color: rgba(col), alfa: 1.0 });
}
fn caja(r: &Valor, x: f64, y: f64, w: f64, hh: f64, c: &Valor, esq: [bool; 4]) {
    lienzo();
    let [tl, tr, bl, br] = esq;
    let r = jmin(jmin(num(r, 0.0), w / 2.0), hh / 2.0);
    let cc = rgba(col(std::slice::from_ref(c)));
    d2(Cmd2D::Camino);
    d2(Cmd2D::Ir(x + if tl { r } else { 0.0 }, y));
    d2(Cmd2D::Linea(x + w - if tr { r } else { 0.0 }, y));
    if tr { d2(Cmd2D::Curva(x + w, y, x + w, y + r)); }
    d2(Cmd2D::Linea(x + w, y + hh - if br { r } else { 0.0 }));
    if br { d2(Cmd2D::Curva(x + w, y + hh, x + w - r, y + hh)); }
    d2(Cmd2D::Linea(x + if bl { r } else { 0.0 }, y + hh));
    if bl { d2(Cmd2D::Curva(x, y + hh, x, y + hh - r)); }
    d2(Cmd2D::Linea(x, y + if tl { r } else { 0.0 }));
    if tl { d2(Cmd2D::Curva(x, y, x + r, y)); }
    d2(Cmd2D::Llenar(cc));
}

pub(crate) fn instalar(e: &mut Estado) {
    let surface = lib(e, "surface");
    let draw = lib(e, "draw");
    g(|g| g.dib = Dib { col: [255.0; 4], tcol: [255.0; 4], mat: Valor::Nil, fuente: "13px Tahoma, sans-serif".into(), tx: 0.0, ty: 0.0, alfa: None });
    for (n, f) in [("DermaDefault", "13px Tahoma"), ("DermaDefaultBold", "bold 13px Tahoma"), ("DermaLarge", "32px Roboto, Tahoma"), ("Default", "13px Tahoma"), ("Trebuchet18", "18px Trebuchet MS"), ("Trebuchet24", "24px Trebuchet MS"), ("HudHintTextLarge", "16px Verdana"), ("HudHintTextSmall", "11px Verdana"), ("ChatFont", "bold 17px Verdana"), ("TargetID", "bold 24px Trebuchet MS"), ("TargetIDSmall", "bold 18px Trebuchet MS"), ("CloseCaption_Normal", "26px Tahoma"), ("HudNumbers", "bold 32px Verdana"), ("HUDNumber5", "bold 45px Trebuchet MS"), ("DebugFixed", "10px Courier New"), ("BudgetLabel", "14px Courier New"), ("CreditsText", "24px Trebuchet MS"), ("GModNotify", "bold 20px Arial")] {
        let (bold, resto) = match f.strip_prefix("bold ") { Some(r) => (true, r), None => (false, f) };
        let i = resto.find("px ").unwrap();
        let sz: f64 = resto[..i].parse().unwrap();
        let fam = resto[i + 3..].split(',').next().unwrap();
        let css = hacer_fuente(fam, sz, if bold { 700.0 } else { 500.0 }, false);
        g(|g| g.fuentes.insert(n.to_string(), css));
    }
    def(&surface, "CreateFont", |_, a, _| {
        let Valor::Tabla(d) = ar(a, 1) else { return Ok(()) };
        let sz = num(&tget(&d, "size"), 13.0);
        let w = num(&tget(&d, "weight"), 500.0);
        let fam = tget(&d, "font");
        let fam = if js_t(&fam) { js_str(&fam) } else { "Tahoma".to_string() };
        let css = hacer_fuente(&fam, sz, w, t(&tget(&d, "italic")));
        let n = js_str(&ar(a, 0));
        g(|g| g.fuentes.insert(n, css));
        Ok(())
    });
    def(&surface, "SetFont", |_, a, _| { let f = fuente(&js_str(&ar(a, 0))); g(|g| g.dib.fuente = f); Ok(()) });
    def(&surface, "GetTextSize", |_, a, o| {
        let f = g(|g| g.dib.fuente.clone());
        let s = texto_de(&ar(a, 0));
        o.push(Valor::Num(ancho(&f, &s).ceil()));
        o.push(Valor::Num(f_alto(&f)));
        Ok(())
    });
    def(&surface, "SetDrawColor", |_, a, _| { let c = col(a); g(|g| g.dib.col = c); Ok(()) });
    def(&surface, "SetTextColor", |_, a, _| { let c = col(a); g(|g| g.dib.tcol = c); Ok(()) });
    def(&surface, "SetTextPos", |_, a, _| { let (x, y) = (num(&ar(a, 0), 0.0), num(&ar(a, 1), 0.0)); g(|g| { g.dib.tx = x; g.dib.ty = y; }); Ok(()) });
    def(&surface, "SetAlphaMultiplier", |_, a, _| { let v = num(&ar(a, 0), 1.0); g(|g| g.dib.alfa = Some(v)); Ok(()) });
    def(&surface, "GetAlphaMultiplier", |_, _, o| { o.push(Valor::Num(g(|g| g.dib.alfa).unwrap_or(1.0))); Ok(()) });
    def(&surface, "DrawText", |_, a, _| {
        lienzo();
        let d = g(|g| g.dib.clone());
        let s = texto_de(&ar(a, 0));
        let w = ancho(&d.fuente, &s);
        d2(Cmd2D::Texto { s, x: d.tx, y: d.ty, fuente: d.fuente.clone(), color: rgba(d.tcol), base: "top".into() });
        g(|g| g.dib.tx += w);
        Ok(())
    });
    def(&surface, "DrawRect", |_, a, _| { lienzo(); let c = g(|g| g.dib.col); d2(Cmd2D::Rect { x: num(&ar(a, 0), 0.0), y: num(&ar(a, 1), 0.0), w: num(&ar(a, 2), 0.0), h: num(&ar(a, 3), 0.0), color: rgba(c), alfa: 1.0 }); Ok(()) });
    def(&surface, "DrawOutlinedRect", |_, a, _| {
        lienzo();
        let c = g(|g| g.dib.col);
        d2(Cmd2D::Borde { x: num(&ar(a, 0), 0.0) + 0.5, y: num(&ar(a, 1), 0.0) + 0.5, w: num(&ar(a, 2), 0.0) - 1.0, h: num(&ar(a, 3), 0.0) - 1.0, color: rgba(c), ancho: num(&ar(a, 4), 1.0) });
        Ok(())
    });
    def(&surface, "DrawLine", |_, a, _| {
        lienzo();
        let c = g(|g| g.dib.col);
        d2(Cmd2D::Camino);
        d2(Cmd2D::Ir(mas(&ar(a, 0)), mas(&ar(a, 1))));
        d2(Cmd2D::Linea(mas(&ar(a, 2)), mas(&ar(a, 3))));
        d2(Cmd2D::Trazar(rgba(c), 1.0));
        Ok(())
    });
    def(&surface, "DrawCircle", |_, a, _| {
        lienzo();
        let c = if a.len() > 3 { col(&a[3..]) } else { g(|g| g.dib.col) };
        d2(Cmd2D::Camino);
        d2(Cmd2D::Arco(num(&ar(a, 0), 0.0), num(&ar(a, 1), 0.0), jmax(0.0, num(&ar(a, 2), 0.0))));
        d2(Cmd2D::Trazar(rgba(c), 1.0));
        Ok(())
    });
    def(&surface, "DrawPoly", |_, a, _| {
        let Valor::Tabla(t) = ar(a, 0) else { return Ok(()) };
        let l = lista(&t);
        if l.is_empty() { return Ok(()); }
        lienzo();
        let c = g(|g| g.dib.col);
        d2(Cmd2D::Camino);
        for (i, p) in l.iter().enumerate() {
            let Valor::Tabla(p) = p else { return Err(Error::nuevo("p.get is not a function")) };
            let (x, y) = (mas(&tget(p, "x")), mas(&tget(p, "y")));
            d2(if i > 0 { Cmd2D::Linea(x, y) } else { Cmd2D::Ir(x, y) });
        }
        d2(Cmd2D::Cerrar);
        d2(Cmd2D::Llenar(rgba(c)));
        Ok(())
    });
    def(&surface, "SetMaterial", |_, a, _| { let m = ar(a, 0); g(|g| g.dib.mat = m); Ok(()) });
    def(&surface, "SetTexture", |_, a, _| { let m = ar(a, 0); let m = if matches!(m, Valor::Tabla(_) | Valor::Udata(_)) { m } else { Valor::Nil }; g(|g| g.dib.mat = m); Ok(()) });
    def(&surface, "GetTextureID", |_, a, o| { let p = ar(a, 0); o.push(crate::resto::material(&if js_t(&p) { js_str(&p) } else { String::new() })); Ok(()) });
    def(&surface, "NoTexture", |_, _, _| { g(|g| g.dib.mat = Valor::Nil); Ok(()) });
    def(&surface, "DrawTexturedRect", |_, a, _| { tex(num(&ar(a, 0), 0.0), num(&ar(a, 1), 0.0), num(&ar(a, 2), 0.0), num(&ar(a, 3), 0.0)); Ok(()) });
    def(&surface, "DrawTexturedRectUV", |_, a, _| { tex(num(&ar(a, 0), 0.0), num(&ar(a, 1), 0.0), num(&ar(a, 2), 0.0), num(&ar(a, 3), 0.0)); Ok(()) });
    def(&surface, "DrawTexturedRectRotated", |_, a, _| {
        lienzo();
        d2(Cmd2D::Guardar);
        d2(Cmd2D::Mover(num(&ar(a, 0), 0.0), num(&ar(a, 1), 0.0)));
        d2(Cmd2D::Rotar(-num(&ar(a, 4), 0.0) * RAD));
        let (w, hh) = (mas(&ar(a, 2)), mas(&ar(a, 3)));
        tex(-w / 2.0, -hh / 2.0, w, hh);
        d2(Cmd2D::Restaurar);
        Ok(())
    });
    def(&surface, "PlaySound", |e, a, _| { crate::motor::sonar(e, &js_str(&ar(a, 0)), None, Valor::Num(1.0), Valor::Num(100.0)); Ok(()) });
    def(&surface, "ScreenWidth", |_, _, o| { o.push(Valor::Num(h(|h| h.pantalla().0))); Ok(()) });
    def(&surface, "ScreenHeight", |_, _, o| { o.push(Valor::Num(h(|h| h.pantalla().1))); Ok(()) });
    def(&surface, "GetHUDTexture", |_, _, o| { o.push(Valor::Nil); Ok(()) });
    for k in ["DisableClipping", "DrawTexturedRectRotatedPoint"] { def(&surface, k, nada); }
    let gl = e.globales();
    def(&gl, "DrawMaterialOverlay", |_, _, _| Ok(()));
    def(&draw, "SimpleText", |_, a, o| {
        let f = ar(a, 1);
        let f = if js_t(&f) { f } else { cad("DermaDefault") };
        let (w, hh) = texto(&ar(a, 0), &f, &ar(a, 2), &ar(a, 3), &ar(a, 4), &ar(a, 5), &ar(a, 6), 0.0, &Valor::Nil);
        o.push(Valor::Num(w)); o.push(Valor::Num(hh)); Ok(())
    });
    def(&draw, "SimpleTextOutlined", |_, a, o| {
        let f = ar(a, 1);
        let f = if js_t(&f) { f } else { cad("DermaDefault") };
        let (w, hh) = texto(&ar(a, 0), &f, &ar(a, 2), &ar(a, 3), &ar(a, 4), &ar(a, 5), &ar(a, 6), num(&ar(a, 7), 1.0), &ar(a, 8));
        o.push(Valor::Num(w)); o.push(Valor::Num(hh)); Ok(())
    });
    def(&draw, "DrawText", |_, a, _| {
        let f = ar(a, 1);
        let f = if js_t(&f) { f } else { cad("DermaDefault") };
        let alto = f_alto(&fuente(&js_str(&f)));
        let y0 = num(&ar(a, 3), 0.0);
        let xa = match ar(a, 5) { Valor::Num(x) if x == 1.0 => 1.0, Valor::Num(x) if x == 2.0 => 2.0, _ => 0.0 };
        for (i, l) in texto_de(&ar(a, 0)).split('\n').enumerate() {
            texto(&cad(l), &f, &ar(a, 2), &Valor::Num(y0 + i as f64 * alto), &ar(a, 4), &Valor::Num(xa), &Valor::Num(0.0), 0.0, &Valor::Nil);
        }
        Ok(())
    });
    def(&draw, "Text", |_, a, o| {
        let Valor::Tabla(t) = ar(a, 0) else { return Ok(()) };
        let p = tget(&t, "pos");
        let (x, y) = match &p { Valor::Tabla(p) => (p.borrow().get_int(1), p.borrow().get_int(2)), _ => (Valor::Num(0.0), Valor::Num(0.0)) };
        let f = tget(&t, "font");
        let f = if js_t(&f) { f } else { cad("DermaDefault") };
        let (w, hh) = texto(&tget(&t, "text"), &f, &x, &y, &tget(&t, "color"), &tget(&t, "xalign"), &tget(&t, "yalign"), 0.0, &Valor::Nil);
        o.push(Valor::Num(w)); o.push(Valor::Num(hh)); Ok(())
    });
    {
        let dr = draw.clone();
        def(&draw, "TextShadow", move |e, a, o| { let f = dr.borrow().get_str("Text"); o.extend(e.llamar_aqui(&f, &[ar(a, 0)])?); Ok(()) });
    }
    def(&draw, "WordBox", |_, a, o| {
        lienzo();
        let (bb, x, y) = (mas(&ar(a, 0)), mas(&ar(a, 1)), mas(&ar(a, 2)));
        let fc = fuente(&js_str(&ar(a, 4)));
        let w = ancho(&fc, &js_str(&ar(a, 3)));
        d2(Cmd2D::Rect { x, y, w: w + bb * 2.0, h: 20.0 + bb, color: rgba(col(&a[5.min(a.len())..])), alfa: 1.0 });
        texto(&ar(a, 3), &ar(a, 4), &Valor::Num(x + bb), &Valor::Num(y + bb / 2.0), &ar(a, 6), &Valor::Num(0.0), &Valor::Num(0.0), 0.0, &Valor::Nil);
        o.push(Valor::Num(w + bb * 2.0)); o.push(Valor::Num(20.0 + bb)); Ok(())
    });
    def(&draw, "RoundedBox", |_, a, _| { caja(&ar(a, 0), num(&ar(a, 1), 0.0), num(&ar(a, 2), 0.0), num(&ar(a, 3), 0.0), num(&ar(a, 4), 0.0), &ar(a, 5), [true; 4]); Ok(()) });
    def(&draw, "RoundedBoxEx", |_, a, _| { caja(&ar(a, 0), num(&ar(a, 1), 0.0), num(&ar(a, 2), 0.0), num(&ar(a, 3), 0.0), num(&ar(a, 4), 0.0), &ar(a, 5), [t(&ar(a, 6)), t(&ar(a, 7)), t(&ar(a, 8)), t(&ar(a, 9))]); Ok(()) });
    def(&draw, "NoTexture", |_, _, _| { g(|g| g.dib.mat = Valor::Nil); Ok(()) });
    def(&draw, "GetFontHeight", |_, a, o| { o.push(Valor::Num(f_alto(&fuente(&js_str(&ar(a, 0)))))); Ok(()) });
    def(&draw, "TexturedQuad", |_, a, _| {
        if let Valor::Tabla(t) = ar(a, 0) { let m = tget(&t, "texture"); g(|g| g.dib.mat = m); tex(mas(&tget(&t, "x")), mas(&tget(&t, "y")), mas(&tget(&t, "w")), mas(&tget(&t, "h"))); }
        Ok(())
    });
    let _: fn() -> R = || Ok(());
}
