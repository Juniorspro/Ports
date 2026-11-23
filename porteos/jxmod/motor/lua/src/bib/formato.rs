//! string.format como `luaFormat` de la web (los números con toFixed/toExponential/toPrecision de JavaScript).
use super::{arg, js_string};
use crate::numeros::{js_tostring, js_tostring_base, to_exponential, to_fixed, to_precision, to_uint32};
use crate::valor::Valor;
use crate::vm::a_num;
use crate::{Error, Estado};

/// "e+5" → "e+05" (como la web: sólo si el exponente tiene una cifra)
fn exp2(s: &mut String) {
    let b = s.as_bytes();
    let n = b.len();
    if n >= 3 && b[n - 1].is_ascii_digit() && (b[n - 2] == b'+' || b[n - 2] == b'-') && b[n - 3] == b'e' { s.insert(n - 1, '0'); }
}

pub(crate) fn formatear(e: &mut Estado, f: &[u8], a: &[Valor]) -> Result<Vec<u8>, Error> {
    let mut k = 0usize;
    let mut out = Vec::with_capacity(f.len() + 16);
    let mut i = 0usize;
    while i < f.len() {
        let c = f[i];
        if c != b'%' { out.push(c); i += 1; continue; }
        i += 1;
        if f.get(i) == Some(&b'%') { out.push(b'%'); i += 1; continue; }
        let mut flags: Vec<u8> = vec![];
        while let Some(&x) = f.get(i) { if b"-+ #0".contains(&x) { flags.push(x); i += 1; } else { break; } }
        let mut w = 0usize;
        let mut hay_w = false;
        while let Some(&x) = f.get(i) { if x.is_ascii_digit() { w = w * 10 + (x - b'0') as usize; hay_w = true; i += 1; } else { break; } }
        let mut pr: Option<usize> = None;
        if f.get(i) == Some(&b'.') {
            i += 1;
            let mut p = 0usize;
            while let Some(&x) = f.get(i) { if x.is_ascii_digit() { p = p * 10 + (x - b'0') as usize; i += 1; } else { break; } }
            pr = Some(p);
        }
        let t = f.get(i).copied();
        let v = arg(a, k).clone();
        k += 1;
        let tiene = |c: u8| flags.contains(&c);
        let num = |e: &Estado| -> Result<f64, Error> {
            a_num(&v).ok_or_else(|| e.error(&format!("bad argument #{} to 'format' (number expected, got {})", k + 1, v.tipo())))
        };
        let s: Vec<u8> = match t {
            Some(b'd') | Some(b'i') => {
                let x = num(e)?.trunc();
                let mut s = js_tostring(x.abs());
                if let Some(p) = pr { while s.len() < p { s.insert(0, '0'); } }
                let signo = if x < 0.0 { "-" } else if tiene(b'+') { "+" } else if tiene(b' ') { " " } else { "" };
                format!("{signo}{s}").into_bytes()
            }
            Some(b'u') => to_uint32(num(e)?.trunc()).to_string().into_bytes(),
            Some(b'c') => vec![(to_uint32(num(e)?) & 0xff) as u8],
            Some(b'x') | Some(b'X') => {
                let x = num(e)?.trunc();
                let mut s = if x < 0.0 { format!("{:x}", to_uint32(x)) } else { js_tostring_base(x, 16) };
                if t == Some(b'X') { s = s.to_uppercase(); }
                if tiene(b'#') && x != 0.0 && !x.is_nan() { s = format!("{}{}", if t == Some(b'X') { "0X" } else { "0x" }, s); }
                s.into_bytes()
            }
            Some(b'o') => js_tostring_base(num(e)?.trunc(), 8).into_bytes(),
            Some(b'e') | Some(b'E') => {
                let x = num(e)?;
                let mut s = to_exponential(x, pr.unwrap_or(6));
                exp2(&mut s);
                if t == Some(b'E') { s = s.to_uppercase(); }
                if x >= 0.0 && tiene(b'+') { s.insert(0, '+'); }
                s.into_bytes()
            }
            Some(b'f') | Some(b'F') => {
                let x = num(e)?;
                let mut s = if x.is_finite() { to_fixed(x, pr.unwrap_or(6)) } else if x.is_nan() { "nan".into() } else if x > 0.0 { "inf".into() } else { "-inf".into() };
                if x >= 0.0 && tiene(b'+') { s.insert(0, '+'); } else if x >= 0.0 && tiene(b' ') { s.insert(0, ' '); }
                s.into_bytes()
            }
            Some(b'g') | Some(b'G') => {
                let x = num(e)?;
                let p = match pr { None => 6, Some(0) => 1, Some(p) => p };
                let mut s = to_precision(x, p);
                if !tiene(b'#') {
                    if let Some(pe) = s.find('e') {
                        let (m, ex) = s.split_at(pe);
                        let mut m = m.to_string();
                        if m.ends_with('0') { while m.ends_with('0') { m.pop(); } if m.ends_with('.') { m.pop(); } }
                        s = format!("{m}{ex}");
                    } else if s.contains('.') && s.ends_with('0') {
                        while s.ends_with('0') { s.pop(); }
                        if s.ends_with('.') { s.pop(); }
                    }
                }
                exp2(&mut s);
                if t == Some(b'G') { s = s.to_uppercase(); }
                s.into_bytes()
            }
            Some(b'q') => {
                let mut s = vec![b'"'];
                for &c in &js_string(&v) {
                    match c {
                        b'\\' => s.extend_from_slice(b"\\\\"),
                        b'"' => s.extend_from_slice(b"\\\""),
                        b'\n' => s.extend_from_slice(b"\\n"),
                        b'\r' => s.extend_from_slice(b"\\r"),
                        0 => s.extend_from_slice(b"\\0"),
                        c => s.push(c),
                    }
                }
                s.push(b'"');
                s
            }
            Some(b's') => {
                let s = e.tostring(&v)?;
                let b = s.bytes();
                match pr { Some(p) if p < b.len() => b[..p].to_vec(), _ => b.to_vec() }
            }
            otro => {
                let c = otro.map(|c| (c as char).to_string()).unwrap_or_default();
                return Err(e.error(&format!("invalid option '%{}' to 'format'", c)));
            }
        };
        if hay_w && s.len() < w {
            let falta = w - s.len();
            if tiene(b'-') {
                out.extend_from_slice(&s);
                out.extend(std::iter::repeat(b' ').take(falta));
            } else if tiene(b'0') && matches!(t, Some(b'd' | b'i' | b'x' | b'X' | b'e' | b'E' | b'f' | b'g' | b'G')) {
                if !s.is_empty() && (s[0] == b'-' || s[0] == b'+') {
                    out.push(s[0]);
                    out.extend(std::iter::repeat(b'0').take(falta));
                    out.extend_from_slice(&s[1..]);
                } else {
                    out.extend(std::iter::repeat(b'0').take(falta));
                    out.extend_from_slice(&s);
                }
            } else {
                out.extend(std::iter::repeat(b' ').take(falta));
                out.extend_from_slice(&s);
            }
        } else {
            out.extend_from_slice(&s);
        }
        i += 1;
    }
    Ok(out)
}
