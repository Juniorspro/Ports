//! Números ↔ textos igual que la versión web (que usa los de JavaScript): `tostring` es `fmtNum` (enteros de menos de
//! 1e15 tal cual, lo demás con 14 cifras como `toPrecision(14)`), `string.format` usa `toFixed`, `toExponential` y
//! `toPrecision`, y la conversión de textos a números es la de `aNum`. JavaScript redondea las mitades exactas hacia
//! arriba (0.5 → 1, 2.5 → 3) y Rust al par: acá se detectan esas mitades exactas y se redondean como JavaScript.

/// cuántos bits después de la coma tiene x (> 0, finito): su expansión decimal exacta tiene esa cantidad de decimales
fn bits_frac(x: f64) -> i32 {
    let b = x.to_bits();
    let e = ((b >> 52) & 0x7ff) as i32;
    let m = b & ((1u64 << 52) - 1);
    let (m, q) = if e == 0 { (m, -1074) } else { (m | (1u64 << 52), e - 1075) };
    if m == 0 { return 0; }
    let q = q + m.trailing_zeros() as i32;
    if q >= 0 { 0 } else { -q }
}

/// partir "d.ddde±N" (lo que da `{:e}` de Rust) en dígitos y exponente
fn partir_e(s: &str) -> (Vec<u8>, i32) {
    let (m, e) = s.split_once('e').unwrap_or((s, "0"));
    let dig: Vec<u8> = m.bytes().filter(|c| c.is_ascii_digit()).collect();
    (dig, e.parse().unwrap_or(0))
}

/// los dígitos más cortos que vuelven al mismo número (x > 0, finito): x = d.ddd × 10^e
fn cortos(x: f64) -> (Vec<u8>, i32) { partir_e(&format!("{:e}", x)) }

/// los dígitos exactos de x (> 0, finito), sin ceros al final
fn exactos(x: f64) -> (Vec<u8>, i32) {
    let (mut d, e) = partir_e(&format!("{:.*e}", 800, x));
    while d.len() > 1 && *d.last().unwrap() == b'0' { d.pop(); }
    (d, e)
}

/// ¿x está justo en la mitad al redondear a `n` cifras significativas? (su expansión exacta tiene n+1 cifras y la
/// última es 5). Devuelve los dígitos exactos en ese caso.
fn empate(x: f64, n: i32) -> Option<(Vec<u8>, i32)> {
    if n < 0 { return None; }
    let k = bits_frac(x);
    if k > 0 {
        let e10 = x.log10().floor() as i32;
        if (e10 + 1 + k - (n + 1)).abs() > 1 { return None; }
    } else if x < 1.8e19 {
        let mut i = x as u64;
        if i == 0 { return None; }
        while i % 10 == 0 { i /= 10; }
        if i % 10 != 5 { return None; }
        let cifras = (i as f64).log10().floor() as i32 + 1;
        if (cifras - (n + 1)).abs() > 1 { return None; }
    }
    let (d, e) = exactos(x);
    if d.len() as i32 == n + 1 && d.last() == Some(&b'5') { Some((d, e)) } else { None }
}

/// sumar uno a la última cifra (con acarreo): 999 → 100 con el exponente uno más; sin cifras → "1"
fn subir(mut d: Vec<u8>, e: i32) -> (Vec<u8>, i32) {
    if d.is_empty() { return (vec![b'1'], e + 1); }
    let mut i = d.len();
    while i > 0 {
        i -= 1;
        if d[i] == b'9' { d[i] = b'0'; } else { d[i] += 1; return (d, e); }
    }
    d.insert(0, b'1');
    d.pop();
    (d, e + 1)
}

/// x (> 0, finito) con exactamente p cifras significativas, redondeado como JavaScript
fn digitos_prec(x: f64, p: usize) -> (Vec<u8>, i32) {
    let (s, e) = cortos(x);
    if p <= 15 && s.len() <= p && x >= f64::MIN_POSITIVE {
        let mut s = s;
        s.resize(p, b'0');
        return (s, e);
    }
    if let Some((d, e)) = empate(x, p as i32) {
        return subir(d[..p].to_vec(), e);
    }
    partir_e(&format!("{:.*e}", p - 1, x))
}

/// Number.prototype.toString() de JavaScript
pub fn js_tostring(x: f64) -> String {
    if x.is_nan() { return "NaN".into(); }
    if x == 0.0 { return "0".into(); }
    if x.is_infinite() { return if x > 0.0 { "Infinity".into() } else { "-Infinity".into() }; }
    if x < 0.0 { return format!("-{}", js_tostring(-x)); }
    let (d, e) = cortos(x);
    let k = d.len() as i32;
    let n = e + 1;
    let ds = String::from_utf8(d).unwrap();
    if k <= n && n <= 21 { return format!("{}{}", ds, "0".repeat((n - k) as usize)); }
    if 0 < n && n <= 21 { return format!("{}.{}", &ds[..n as usize], &ds[n as usize..]); }
    if -6 < n && n <= 0 { return format!("0.{}{}", "0".repeat((-n) as usize), ds); }
    let ex = n - 1;
    let signo = if ex >= 0 { '+' } else { '-' };
    if k == 1 { format!("{}e{}{}", ds, signo, ex.abs()) } else { format!("{}.{}e{}{}", &ds[..1], &ds[1..], signo, ex.abs()) }
}

/// Number.prototype.toPrecision(p) de JavaScript
pub fn to_precision(x: f64, p: usize) -> String {
    if !x.is_finite() { return js_tostring(x); }
    let p = p.clamp(1, 100);
    if x == 0.0 { return if p == 1 { "0".into() } else { format!("0.{}", "0".repeat(p - 1)) }; }
    let neg = x < 0.0;
    let (d, e) = digitos_prec(x.abs(), p);
    let ds = String::from_utf8(d).unwrap();
    let s = if e < -6 || e >= p as i32 {
        let signo = if e >= 0 { '+' } else { '-' };
        if p == 1 { format!("{}e{}{}", ds, signo, e.abs()) } else { format!("{}.{}e{}{}", &ds[..1], &ds[1..], signo, e.abs()) }
    } else if e >= 0 {
        let ent = (e + 1) as usize;
        if ent >= p { ds } else { format!("{}.{}", &ds[..ent], &ds[ent..]) }
    } else {
        format!("0.{}{}", "0".repeat((-e - 1) as usize), ds)
    };
    if neg { format!("-{s}") } else { s }
}

/// Number.prototype.toExponential(f) de JavaScript
pub fn to_exponential(x: f64, f: usize) -> String {
    if !x.is_finite() { return js_tostring(x); }
    let f = f.min(100);
    let neg = x < 0.0;
    let (d, e) = if x == 0.0 { (vec![b'0'; f + 1], 0) } else { digitos_prec(x.abs(), f + 1) };
    let ds = String::from_utf8(d).unwrap();
    let signo = if e >= 0 { '+' } else { '-' };
    let s = if f == 0 { format!("{}e{}{}", ds, signo, e.abs()) } else { format!("{}.{}e{}{}", &ds[..1], &ds[1..], signo, e.abs()) };
    if neg { format!("-{s}") } else { s }
}

/// Number.prototype.toFixed(f) de JavaScript
pub fn to_fixed(x: f64, f: usize) -> String {
    if x.is_nan() { return "NaN".into(); }
    if !(x.abs() < 1e21) { return js_tostring(x); }
    let f = f.min(100);
    let neg = x < 0.0;
    let a = x.abs();
    let s = if a == 0.0 {
        format!("{:.*}", f, 0.0)
    } else {
        // (una mitad exacta en el decimal f+1: hacia arriba, como JavaScript)
        let e10 = a.log10().floor() as i32;
        let mut hecho = None;
        for e_prueba in [e10, e10 + 1, e10 - 1] {
            let n = e_prueba + 1 + f as i32;
            if let Some((d, e)) = empate(a, n) {
                if e + 1 + f as i32 == n {
                    let (d, e) = subir(d[..n as usize].to_vec(), e);
                    hecho = Some(componer_fijo(&d, e, f));
                    break;
                }
            }
        }
        hecho.unwrap_or_else(|| format!("{:.*}", f, a))
    };
    if neg { format!("-{s}") } else { s }
}

/// armar "ddd.ddd" con `f` decimales a partir de dígitos (d.ddd × 10^e)
fn componer_fijo(d: &[u8], e: i32, f: usize) -> String {
    let dig = |i: i32| -> u8 { if i >= 0 && (i as usize) < d.len() { d[i as usize] } else { b'0' } };
    let mut s = String::new();
    if e >= 0 { for i in 0..=e { s.push(dig(i) as char); } } else { s.push('0'); }
    if f > 0 {
        s.push('.');
        for j in 0..f as i32 { s.push(dig(e + 1 + j) as char); }
    }
    s
}

/// Math.floor sin llamar a la biblioteca de C (en x86-64 sin SSE4.1 `f64::floor` es una llamada): igual resultado,
/// también para -0, nan e infinitos
#[inline(always)]
pub fn piso(x: f64) -> f64 {
    if x.abs() < 4503599627370496.0 {
        if x == 0.0 { return x; }
        // SAFETY: |x| < 2^52 entra en un i64 (y no es nan)
        let i = unsafe { x.to_int_unchecked::<i64>() } as f64;
        if i > x { i - 1.0 } else { i }
    } else {
        x
    }
}

/// el `tostring` de un número (fmtNum de la web)
pub fn fmt_num(n: f64) -> String {
    if n.fract() == 0.0 && n.abs() < 1e15 { return format!("{}", n as i64); }
    if n.is_nan() { return "nan".into(); }
    if n.is_infinite() { return if n > 0.0 { "inf".into() } else { "-inf".into() }; }
    let s = to_precision(n, 14);
    if let Some((m, e)) = s.split_once('e') {
        let mut m = m.to_string();
        if m.contains('.') { recortar_ceros(&mut m); }
        let ex: i32 = e.parse().unwrap_or(0);
        return format!("{}e{}{:02}", m, if ex < 0 { '-' } else { '+' }, ex.abs());
    }
    let mut s = s;
    if s.contains('.') { recortar_ceros(&mut s); }
    s
}

/// sacar los ceros del final de los decimales (y el punto si queda solo)
pub(crate) fn recortar_ceros(s: &mut String) {
    while s.ends_with('0') { s.pop(); }
    if s.ends_with('.') { s.pop(); }
}

/// escribir un número en un búfer de bytes (para concatenar sin armar textos de más)
pub(crate) fn escribir_num(n: f64, out: &mut Vec<u8>) {
    if n.fract() == 0.0 && n.abs() < 1e15 {
        let mut i = n as i64;
        if i == 0 { out.push(b'0'); return; }
        if i < 0 { out.push(b'-'); i = -i; }
        let mut buf = [0u8; 20];
        let mut k = buf.len();
        while i > 0 { k -= 1; buf[k] = b'0' + (i % 10) as u8; i /= 10; }
        out.extend_from_slice(&buf[k..]);
    } else {
        out.extend_from_slice(fmt_num(n).as_bytes());
    }
}

fn es_blanco(c: u8) -> bool { matches!(c, b' ' | b'\t' | b'\n' | b'\r' | 0x0b | 0x0c) }

fn recortar(s: &[u8]) -> &[u8] {
    let mut a = 0;
    let mut b = s.len();
    while a < b && es_blanco(s[a]) { a += 1; }
    while b > a && es_blanco(s[b - 1]) { b -= 1; }
    &s[a..b]
}

/// el número de un texto como `aNum` de la web: decimal (con exponente) o hexadecimal entero, con blancos alrededor;
/// inf y nan no valen
pub fn texto_a_num(s: &[u8]) -> Option<f64> {
    let t = recortar(s);
    if t.is_empty() { return None; }
    let (neg, cuerpo) = match t[0] { b'-' => (true, &t[1..]), b'+' => (false, &t[1..]), _ => (false, t) };
    if cuerpo.len() > 2 && cuerpo[0] == b'0' && (cuerpo[1] == b'x' || cuerpo[1] == b'X') {
        let h = &cuerpo[2..];
        if h.is_empty() || !h.iter().all(|c| c.is_ascii_hexdigit()) { return None; }
        let mut v: f64 = 0.0;
        let mut entero: u128 = 0;
        let mut exacto = true;
        for &c in h {
            let d = (c as char).to_digit(16).unwrap();
            if exacto {
                match entero.checked_mul(16).and_then(|x| x.checked_add(d as u128)) { Some(x) => entero = x, None => { exacto = false; v = entero as f64 * 16.0 + d as f64; } }
            } else {
                v = v * 16.0 + d as f64;
            }
        }
        let v = if exacto { entero as f64 } else { v };
        return Some(if neg { -v } else { v });
    }
    // ^(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$
    let mut i = 0;
    let n = cuerpo.len();
    let ini_ent = i;
    while i < n && cuerpo[i].is_ascii_digit() { i += 1; }
    let dig_ent = i - ini_ent;
    let mut dig_frac = 0;
    if i < n && cuerpo[i] == b'.' {
        i += 1;
        let a = i;
        while i < n && cuerpo[i].is_ascii_digit() { i += 1; }
        dig_frac = i - a;
    }
    if dig_ent == 0 && dig_frac == 0 { return None; }
    if i < n && (cuerpo[i] == b'e' || cuerpo[i] == b'E') {
        i += 1;
        if i < n && (cuerpo[i] == b'+' || cuerpo[i] == b'-') { i += 1; }
        let a = i;
        while i < n && cuerpo[i].is_ascii_digit() { i += 1; }
        if i == a { return None; }
    }
    if i != n { return None; }
    let txt = std::str::from_utf8(cuerpo).ok()?;
    let txt = if txt.ends_with('.') { &txt[..txt.len() - 1] } else { txt };
    let txt = txt.replace(".e", "e").replace(".E", "E");
    let v: f64 = txt.parse().ok()?;
    Some(if neg { -v } else { v })
}

/// ToNumber de JavaScript para un texto (lo usan las funciones de math que la web llama sin convertir)
pub fn js_texto_a_numero(s: &[u8]) -> f64 {
    let t = recortar(s);
    if t.is_empty() { return 0.0; }
    match t {
        b"Infinity" | b"+Infinity" => return f64::INFINITY,
        b"-Infinity" => return f64::NEG_INFINITY,
        _ => {}
    }
    if t.len() > 2 && t[0] == b'0' {
        let base = match t[1] { b'x' | b'X' => 16, b'o' | b'O' => 8, b'b' | b'B' => 2, _ => 0 };
        if base != 0 {
            let mut v = 0f64;
            for &c in &t[2..] { match (c as char).to_digit(base) { Some(d) => v = v * base as f64 + d as f64, None => return f64::NAN } }
            return v;
        }
    }
    if t.len() > 2 && (t[1] == b'x' || t[1] == b'X') { return f64::NAN; }
    texto_a_num(t).filter(|_| !t.starts_with(b"0x") && !t.starts_with(b"-0x") && !t.starts_with(b"+0x")).unwrap_or(f64::NAN)
}

/// ToInt32 de JavaScript (x | 0)
pub fn to_int32(x: f64) -> i32 {
    if !x.is_finite() { return 0; }
    let t = x.trunc();
    let m = t.rem_euclid(4294967296.0);
    m as u32 as i32
}
/// ToUint32 de JavaScript (x >>> 0)
pub fn to_uint32(x: f64) -> u32 { to_int32(x) as u32 }

/// un entero en otra base como Number.prototype.toString(base) (x entero)
pub fn js_tostring_base(x: f64, base: u32) -> String {
    if !x.is_finite() { return js_tostring(x); }
    if x == 0.0 { return "0".into(); }
    let neg = x < 0.0;
    let mut a = x.abs().trunc();
    let mut dig = Vec::new();
    if a < 1.8e19 {
        let mut i = a as u64;
        while i > 0 { dig.push(std::char::from_digit((i % base as u64) as u32, base).unwrap()); i /= base as u64; }
    } else {
        while a >= 1.0 { let d = a % base as f64; dig.push(std::char::from_digit(d as u32, base).unwrap()); a = ((a - d) / base as f64).trunc(); }
    }
    let s: String = dig.iter().rev().collect();
    if neg { format!("-{s}") } else { s }
}

#[cfg(test)]
mod pruebas {
    use super::*;
    #[test]
    fn formatos() {
        assert_eq!(fmt_num(1.0), "1");
        assert_eq!(fmt_num(-0.0), "0");
        assert_eq!(fmt_num(0.1), "0.1");
        assert_eq!(fmt_num(0.1 + 0.2), "0.3");
        assert_eq!(fmt_num(1e15), "1e+15");
        assert_eq!(fmt_num(123456789012345.0), "123456789012345");
        assert_eq!(fmt_num(0.00001), "0.00001");
        assert_eq!(fmt_num(1e-7), "1e-07");
        assert_eq!(fmt_num(2f64.powi(-21)), "4.7683715820313e-07");
        assert_eq!(fmt_num(f64::NAN), "nan");
        assert_eq!(fmt_num(1.0 / 3.0), "0.33333333333333");
        assert_eq!(to_fixed(2.5, 0), "3");
        assert_eq!(to_fixed(0.125, 2), "0.13");
        assert_eq!(to_fixed(-0.001, 2), "-0.00");
        assert_eq!(to_fixed(1.005, 2), "1.00");
        assert_eq!(to_precision(25.0, 1), "3e+1");
        assert_eq!(js_tostring(1e21), "1e+21");
        assert_eq!(js_tostring(123.456), "123.456");
        assert_eq!(js_tostring(1e-7), "1e-7");
        assert_eq!(to_exponential(12345.0, 2), "1.23e+4");
        assert_eq!(texto_a_num(b" 0x10 "), Some(16.0));
        assert_eq!(texto_a_num(b"1e5"), Some(1e5));
        assert_eq!(texto_a_num(b"5."), Some(5.0));
        assert_eq!(texto_a_num(b".5"), Some(0.5));
        assert_eq!(texto_a_num(b"inf"), None);
        assert_eq!(texto_a_num(b"1.2.3"), None);
        assert_eq!(to_int32(4294967295.0), -1);
    }
}
