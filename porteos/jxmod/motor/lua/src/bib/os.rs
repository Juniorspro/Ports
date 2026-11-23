//! os: time, clock, date, difftime y getenv (como la web: la hora local del sistema, clock desde que arrancó el Lua).
use super::*;
use crate::valor::{Tabla, Valor};
use crate::{Error, Estado};

pub(crate) fn abrir(e: &mut Estado) {
    let o = lib(e, "os");
    def(&o, "time", time);
    def(&o, "clock", clock);
    def(&o, "difftime", difftime);
    def(&o, "date", date);
    def(&o, "getenv", getenv);
}

/// la diferencia de la hora local con UTC, en segundos (la del sistema ahora; 0 si no se sabe)
pub(crate) fn zona_local() -> i64 {
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        use std::os::raw::{c_char, c_int, c_long};
        #[repr(C)]
        struct Tm { sec: c_int, min: c_int, hour: c_int, mday: c_int, mon: c_int, year: c_int, wday: c_int, yday: c_int, isdst: c_int, gmtoff: c_long, zone: *const c_char }
        extern "C" { fn localtime_r(t: *const c_long, tm: *mut Tm) -> *mut Tm; }
        let ahora = ahora_seg() as c_long;
        let mut tm = Tm { sec: 0, min: 0, hour: 0, mday: 0, mon: 0, year: 0, wday: 0, yday: 0, isdst: 0, gmtoff: 0, zone: std::ptr::null() };
        // SAFETY: localtime_r sólo escribe en tm, que es nuestra
        let r = unsafe { localtime_r(&ahora, &mut tm) };
        if !r.is_null() { return tm.gmtoff as i64; }
    }
    0
}

fn ahora_ms() -> f64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs_f64() * 1000.0).unwrap_or(0.0)
}
fn ahora_seg() -> i64 { (ahora_ms() / 1000.0).floor() as i64 }

/// días desde 1970-01-01 de una fecha (el mes puede pasarse de 1..12, como Date de JavaScript)
fn dias_de(y: i64, m: i64, d: i64) -> i64 {
    let y = y + (m - 1).div_euclid(12);
    let m = (m - 1).rem_euclid(12) + 1;
    let y2 = if m <= 2 { y - 1 } else { y };
    let era = y2.div_euclid(400);
    let yoe = y2 - era * 400;
    let mp = (m + 9) % 12;
    let doy = (153 * mp + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146097 + doe - 719468
}

/// (año, mes, día) de un número de días desde 1970-01-01
fn fecha_de(z: i64) -> (i64, i64, i64) {
    let z = z + 719468;
    let era = z.div_euclid(146097);
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    (if m <= 2 { y + 1 } else { y }, m, d)
}

fn time(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    if let Valor::Tabla(t) = arg(a, 0) {
        let tb = t.borrow();
        let campo = |k: &str, d: f64| -> f64 { let v = js_num(&tb.get_str(k)); if v == 0.0 || v.is_nan() { d } else { v } };
        let anio = js_num(&tb.get_str("year"));
        let (mes, dia, hora, min, seg) = (campo("month", 1.0), campo("day", 1.0), campo("hour", 12.0), campo("min", 0.0), campo("sec", 0.0));
        if !anio.is_finite() { out.push(Valor::Num(f64::NAN)); return Ok(()); }
        let dias = dias_de(anio as i64, mes as i64, 0) + dia as i64;
        let local = dias as f64 * 86400.0 + hora * 3600.0 + min * 60.0 + seg;
        out.push(Valor::Num((local - e.zona as f64).floor()));
    } else {
        out.push(Valor::Num(ahora_seg() as f64));
    }
    Ok(())
}

fn clock(e: &mut Estado, _: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    out.push(Valor::Num(e.t0.elapsed().as_secs_f64()));
    Ok(())
}

fn difftime(_: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let b = if js_verdad(arg(a, 1)) { js_num(arg(a, 1)) } else { 0.0 };
    out.push(Valor::Num(js_num(arg(a, 0)) - b));
    Ok(())
}

fn date(e: &mut Estado, a: &[Valor], out: &mut Vec<Valor>) -> Result<(), Error> {
    let ms = if arg(a, 1).es_nil() { ahora_ms() } else { js_num(arg(a, 1)) * 1000.0 };
    let mut f = if arg(a, 0).es_nil() { b"%c".to_vec() } else { js_string(arg(a, 0)) };
    let utc = f.first() == Some(&b'!');
    if utc { f.remove(0); }
    let seg = (ms / 1000.0).floor() as i64 + if utc { 0 } else { e.zona };
    let dias = seg.div_euclid(86400);
    let s_dia = seg.rem_euclid(86400);
    let (y, m, d) = fecha_de(dias);
    let (hh, mm, ss) = (s_dia / 3600, (s_dia / 60) % 60, s_dia % 60);
    let wday = (dias + 4).rem_euclid(7) + 1;
    if f.starts_with(b"*t") {
        let t = Tabla::nueva_ref();
        {
            let mut tb = t.borrow_mut();
            for (k, v) in [("year", y), ("month", m), ("day", d), ("hour", hh), ("min", mm), ("sec", ss), ("wday", wday), ("yday", 1)] {
                tb.set_str(k, Valor::Num(v as f64));
            }
            tb.set_str("isdst", Valor::Bool(false));
        }
        out.push(Valor::Tabla(t));
        return Ok(());
    }
    let h12 = if hh % 12 == 0 { 12 } else { hh % 12 };
    let ampm = if hh < 12 { "AM" } else { "PM" };
    let mut r = String::new();
    let mut i = 0;
    while i < f.len() {
        if f[i] == b'%' && i + 1 < f.len() {
            let c = f[i + 1];
            match c {
                b'Y' => r.push_str(&y.to_string()),
                b'y' => r.push_str(&format!("{:02}", y.rem_euclid(100))),
                b'm' => r.push_str(&format!("{:02}", m)),
                b'd' => r.push_str(&format!("{:02}", d)),
                b'H' => r.push_str(&format!("{:02}", hh)),
                b'M' => r.push_str(&format!("{:02}", mm)),
                b'S' => r.push_str(&format!("{:02}", ss)),
                b'p' => r.push_str(ampm),
                b'c' => r.push_str(&format!("{}/{}/{}, {}:{:02}:{:02} {}", m, d, y, h12, mm, ss, ampm)),
                b'x' => r.push_str(&format!("{}/{}/{}", m, d, y)),
                b'X' => r.push_str(&format!("{}:{:02}:{:02} {}", h12, mm, ss, ampm)),
                b'%' => r.push('%'),
                _ => {}
            }
            i += 2;
        } else {
            r.push(f[i] as char);
            i += 1;
        }
    }
    out.push(Valor::from(r));
    Ok(())
}

fn getenv(_: &mut Estado, _: &[Valor], _: &mut Vec<Valor>) -> Result<(), Error> { Ok(()) }
